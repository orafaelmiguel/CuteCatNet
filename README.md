# CuteCatNet
<img width="200" height="200" alt="cutecat" src="https://github.com/user-attachments/assets/a22c6fdc-ad03-4d22-89d7-9d986ed61bdf" />

A open-source network discovery tool built with Rust. Performs ARP-based network scanning to discover devices on local networks with manufacturer identification and hostname resolution.

## Windows prerequisite (Npcap)

On Windows, CuteCatNet uses low-level packet capture APIs provided by Npcap. If you see an error like "Packet.dll not found" when launching the app, install Npcap:

1. Download Npcap from `https://nmap.org/npcap/`
2. During setup, check: "Install Npcap in WinPcap API-compatible Mode"
3. Finish installation and launch CuteCatNet again

## Network Implementation

CuteCatNet uses low-level networking techniques to discover devices on the local network without requiring elevated privileges on most systems.

### ARP Scanning Methodology

The core discovery mechanism uses Address Resolution Protocol (ARP) requests to map the local network segment. The scanner:

1. **Interface Detection**: Uses `default-net` crate to identify the active network interface and obtain the default gateway information
2. **Network Enumeration**: Calculates the network range using CIDR notation from the interface's IP configuration
3. **ARP Request Generation**: Constructs raw ARP packets using the `pnet` crate for each IP in the target range
4. **Packet Structure**: Each ARP request contains:
   - Ethernet header with broadcast destination MAC
   - ARP payload requesting MAC address for target IP
   - Source MAC and IP from the scanning interface

### Packet Processing

The implementation uses `pnet::datalink` channels for raw packet transmission and reception:

```rust
// Creates bidirectional channel for layer 2 communication
let (mut tx, mut rx) = datalink::channel(&interface, Default::default())?;

// ARP request construction
arp_packet.set_hardware_type(ArpHardwareTypes::Ethernet);
arp_packet.set_protocol_type(EtherTypes::Ipv4);
arp_packet.set_operation(ArpOperations::Request);
```

Response processing runs asynchronously, parsing incoming ARP replies to extract device information. Each reply contains the responding device's MAC address, which is then cross-referenced with the embedded OUI database for manufacturer identification.

### Manufacturer Resolution

The OUI (Organizationally Unique Identifier) database maps the first three bytes of MAC addresses to manufacturer names. The implementation:

- Embeds a CSV database at compile time using `include_str!`
- Performs prefix matching on normalized MAC addresses
- Falls back to "Unknown" for unregistered or private MAC addresses

### Hostname Resolution

DNS reverse lookups attempt to resolve hostnames for discovered IP addresses using the `dns-lookup` crate. This provides human-readable device identification when DNS records are available.

### Network Permissions

The application requires raw socket access for ARP packet generation. On most systems this works without elevation, but some configurations may require administrator privileges.

The implementation prioritizes safety and cross-platform compatibility. Raw networking operations use safe Rust abstractions, and all network I/O is handled asynchronously to prevent UI blocking. The embedded OUI database ensures manufacturer lookups work offline.

Error handling covers common network scenarios including interface detection failures, packet transmission errors, and DNS resolution timeouts. The application gracefully degrades when network operations fail, providing meaningful error messages to users.
