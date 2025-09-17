// src-tauri/src/scanner.rs

use serde::Serialize;
use pnet::datalink::MacAddr;
use std::net::Ipv4Addr;
use thiserror::Error;

// Estrutura que será serializada para JSON e enviada ao frontend.
// Os derives são essenciais:
// - Serialize: Permite a conversão para JSON.
// - Clone: Permite criar cópias da struct.
// - Debug: Permite imprimir a struct para depuração.
#[derive(Serialize, Clone, Debug)]
pub struct Device {
    ip_address: String,
    mac_address: String,
    manufacturer: String,
}

// Enum para tratamento de erros customizado. Isso nos dá mensagens de erro claras.
// O derive `Error` e `Debug` vem do `thiserror`.
#[derive(Error, Debug)]
pub enum ScanError {
    #[error("Nenhuma interface de rede ativa foi encontrada.")]
    NoActiveInterface,
    #[error("Falha ao criar o canal de comunicação da camada de enlace.")]
    ChannelCreationFailure,
    #[error("Erro de I/O: {0}")]
    IoError(#[from] std::io::Error),
    #[error("Default network interface not found.")]
    DefaultInterfaceNotFound,
}

// Função que recebe um MacAddr e retorna o nome do fabricante.
// Se não encontrar, retorna "Desconhecido" de forma segura.
fn get_manufacturer(mac: &MacAddr) -> String {
    let oui_db = mac_oui::Oui::default().unwrap();
    let mac_string = mac.to_string();
    match oui_db.lookup_by_mac(&mac_string) {
        Ok(Some(entry)) => entry.company_name.clone(),
        _ => "Unknown".to_string(),
    }
}

use pnet::datalink::{self, Channel};
use pnet::packet::arp::{ArpOperations, ArpPacket, MutableArpPacket};
use pnet::packet::ethernet::{EtherTypes, EthernetPacket, MutableEthernetPacket};
use pnet::packet::Packet;
use ipnetwork::Ipv4Network;
use std::time::Duration;
use tokio::time::timeout;
use std::collections::HashMap;

pub async fn perform_scan() -> Result<Vec<Device>, ScanError> {
    // 1. Encontrar a interface de rede correta.
    // Usaremos a biblioteca `default-net` para encontrar a interface que tem o gateway padrão.
    // É a aposta mais segura para encontrar a interface conectada à internet/LAN.
    let interfaces = datalink::interfaces();
    let default_interface = match default_net::get_default_interface() {
        Ok(iface) => iface,
        Err(_) => return Err(ScanError::DefaultInterfaceNotFound),
    };

    let interface = interfaces
        .into_iter()
        .find(|iface| iface.name == default_interface.name)
        .ok_or(ScanError::NoActiveInterface)?;

    // 2. Extrair o endereço IPv4 e a máscara de sub-rede da interface.
    let source_ipv4 = interface
        .ips
        .iter()
        .find(|ip| ip.is_ipv4())
        .map(|ip| match ip.ip() {
            std::net::IpAddr::V4(ip) => ip,
            _ => unreachable!(),
        })
        .ok_or(ScanError::NoActiveInterface)?;

    let network = Ipv4Network::new(source_ipv4, interface.ips.iter().find(|ip| ip.is_ipv4()).unwrap().prefix())
        .expect("Invalid network configuration");

    // 3. Abrir um canal de comunicação na camada de enlace (datalink).
    let (mut tx, mut rx) = match datalink::channel(&interface, Default::default()) {
        Ok(Channel::Ethernet(tx, rx)) => (tx, rx),
        Ok(_) => return Err(ScanError::ChannelCreationFailure),
        Err(e) => return Err(ScanError::IoError(e)),
    };
    
    let source_mac = interface.mac.unwrap();
    let mut found_devices = HashMap::new();

    // Adicionar o próprio dispositivo à lista
    found_devices.insert(source_ipv4, Device {
        ip_address: source_ipv4.to_string(),
        mac_address: source_mac.to_string(),
        manufacturer: get_manufacturer(&source_mac),
    });

    // 4. Iterar sobre todos os IPs da sub-rede e enviar pacotes ARP.
    for target_ipv4 in network.iter() {
        if target_ipv4 == source_ipv4 { continue; }

        let mut ethernet_buffer = [0u8; 42];
        let mut ethernet_packet = MutableEthernetPacket::new(&mut ethernet_buffer).unwrap();

        ethernet_packet.set_destination(MacAddr::broadcast());
        ethernet_packet.set_source(source_mac);
        ethernet_packet.set_ethertype(EtherTypes::Arp);

        let mut arp_buffer = [0u8; 28];
        let mut arp_packet = MutableArpPacket::new(&mut arp_buffer).unwrap();

        arp_packet.set_hardware_type(pnet::packet::arp::ArpHardwareTypes::Ethernet);
        arp_packet.set_protocol_type(EtherTypes::Ipv4);
        arp_packet.set_hw_addr_len(6);
        arp_packet.set_proto_addr_len(4);
        arp_packet.set_operation(ArpOperations::Request);
        arp_packet.set_sender_hw_addr(source_mac);
        arp_packet.set_sender_proto_addr(source_ipv4);
        arp_packet.set_target_hw_addr(MacAddr::zero());
        arp_packet.set_target_proto_addr(target_ipv4);
        
        ethernet_packet.set_payload(arp_packet.packet());

        if tx.send_to(ethernet_packet.packet(), None).is_none() {
            return Err(ScanError::ChannelCreationFailure);
        };
    }
    
    // 5. Escutar por respostas por um tempo determinado (timeout).
    let receiver_task = tokio::spawn(async move {
        let mut devices = HashMap::new();
        loop {
            match rx.next() {
                Ok(packet) => {
                    if let Some(ethernet_packet) = EthernetPacket::new(packet) {
                        if ethernet_packet.get_ethertype() == EtherTypes::Arp {
                            if let Some(arp_packet) = ArpPacket::new(ethernet_packet.payload()) {
                                if arp_packet.get_operation() == ArpOperations::Reply {
                                    let sender_ip = arp_packet.get_sender_proto_addr();
                                    let sender_mac = arp_packet.get_sender_hw_addr();
                                    if !devices.contains_key(&sender_ip) {
                                        let device = Device {
                                            ip_address: sender_ip.to_string(),
                                            mac_address: sender_mac.to_string(),
                                            manufacturer: get_manufacturer(&sender_mac),
                                        };
                                        println!("Device found: {:?}", device);
                                        devices.insert(sender_ip, device);
                                    }
                                }
                            }
                        }
                    }
                }
                Err(e) => {
                    eprintln!("An error occurred while receiving packet: {}", e);
                    break;
                }
            }
        }
        devices
    });

    if let Ok(devices_map) = timeout(Duration::from_secs(5), receiver_task).await {
        found_devices.extend(devices_map.unwrap());
    } else {
        println!("Scan timed out.");
    }
    
    let mut devices: Vec<Device> = found_devices.into_values().collect();
    devices.sort_by(|a, b| a.ip_address.parse::<Ipv4Addr>().unwrap().cmp(&b.ip_address.parse::<Ipv4Addr>().unwrap()));
    Ok(devices)
}
