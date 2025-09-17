// src-tauri/src/scanner.rs

use serde::Serialize;
use pnet::datalink::MacAddr;
use std::net::{IpAddr, Ipv4Addr};
use thiserror::Error;

#[derive(Serialize, Clone, Debug)]
pub struct Device {
	ip_address: String,
	mac_address: String,
	manufacturer: String,
	hostname: String,
}

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

use crate::oui_db::OuiDb;

fn get_manufacturer_with_db(db: &OuiDb, mac: &MacAddr) -> String {
	let mac_string = mac.to_string().to_lowercase();
	db.lookup(&mac_string).unwrap_or("Unknown").to_string()
}

fn resolve_hostname(ip: Ipv4Addr) -> String {
	match dns_lookup::lookup_addr(&IpAddr::V4(ip)) {
		Ok(name) => name,
		Err(_) => "Unknown".to_string(),
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
use std::sync::{Arc, Mutex};

pub async fn perform_scan() -> Result<Vec<Device>, ScanError> {
	let interfaces = datalink::interfaces();
	let default_interface = match default_net::get_default_interface() {
		Ok(iface) => iface,
		Err(_) => return Err(ScanError::DefaultInterfaceNotFound),
	};

	let interface = interfaces
		.into_iter()
		.find(|iface| iface.index == default_interface.index)
		.ok_or(ScanError::NoActiveInterface)?;

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

	let (mut tx, mut rx) = match datalink::channel(&interface, Default::default()) {
		Ok(Channel::Ethernet(tx, rx)) => (tx, rx),
		Ok(_) => return Err(ScanError::ChannelCreationFailure),
		Err(e) => return Err(ScanError::IoError(e)),
	};
	
	let source_mac = interface.mac.unwrap();
	let found_devices = Arc::new(Mutex::new(HashMap::new()));
	let db = Arc::new(OuiDb::new_embedded());

	let own_device = Device {
		ip_address: source_ipv4.to_string(),
		mac_address: source_mac.to_string(),
		manufacturer: get_manufacturer_with_db(&db, &source_mac),
		hostname: resolve_hostname(source_ipv4),
	};
	found_devices.lock().unwrap().insert(source_ipv4, own_device);

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

		let _ = tx.send_to(ethernet_packet.packet(), None);
	}
	
	let devices_clone = Arc::clone(&found_devices);
	let db_clone = Arc::clone(&db);
	let receiver_task = tokio::spawn(async move {
		loop {
			match rx.next() {
				Ok(packet) => {
					if let Some(ethernet_packet) = EthernetPacket::new(packet) {
						if ethernet_packet.get_ethertype() == EtherTypes::Arp {
							if let Some(arp_packet) = ArpPacket::new(ethernet_packet.payload()) {
								if arp_packet.get_operation() == ArpOperations::Reply {
									let sender_ip = arp_packet.get_sender_proto_addr();
									let sender_mac = arp_packet.get_sender_hw_addr();
									let mut devices = devices_clone.lock().unwrap();
									if !devices.contains_key(&sender_ip) {
										let device = Device {
											ip_address: sender_ip.to_string(),
											mac_address: sender_mac.to_string(),
											manufacturer: get_manufacturer_with_db(&db_clone, &sender_mac),
											hostname: resolve_hostname(sender_ip),
										};
										println!("Device found: {:?}", device);
										devices.insert(sender_ip, device);
									}
								}
							}
						}
					}
				}
				Err(_) => break,
			}
		}
	});

	let _ = timeout(Duration::from_secs(5), receiver_task).await;
	let final_devices = found_devices.lock().unwrap();
	let mut devices: Vec<Device> = final_devices.values().cloned().collect();
	devices.sort_by(|a, b| a.ip_address.parse::<Ipv4Addr>().unwrap().cmp(&b.ip_address.parse::<Ipv4Addr>().unwrap()));
	Ok(devices)
}
