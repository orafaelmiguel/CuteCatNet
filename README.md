# CuteCatNet

Cross-platform network discovery tool built with Tauri and Rust. Performs ARP-based network scanning to discover devices on local networks with manufacturer identification and hostname resolution.

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

## Architecture

### Backend (Rust)

- **Scanner Module**: Implements ARP scanning logic with async/await patterns
- **OUI Database**: Embedded manufacturer lookup with HashMap-based indexing
- **Error Handling**: Comprehensive error types using `thiserror` for network failures
- **Tauri Commands**: Exposes scanning functionality to the frontend via `#[tauri::command]`

### Frontend (React/TypeScript)

- **Component Architecture**: Modular sidebar navigation with view switching
- **State Management**: React hooks for device list, loading states, and error handling
- **UI Framework**: Shadcn/ui components with Tailwind CSS styling
- **Type Safety**: Full TypeScript coverage with shared interfaces between Rust and frontend

## Technology Stack

### Core Dependencies

- **Tauri 2.0**: Cross-platform desktop framework
- **pnet**: Low-level network packet manipulation
- **ipnetwork**: IP address and subnet calculations
- **tokio**: Async runtime for non-blocking network operations
- **default-net**: Network interface discovery
- **dns-lookup**: Reverse DNS resolution

### Frontend Stack

- **React 18**: Component-based UI framework
- **TypeScript**: Static type checking
- **Vite**: Build tool and development server
- **Tailwind CSS 3.4**: Utility-first styling
- **Lucide React**: Icon library

## Development

### Prerequisites

- Rust 1.70+
- Node.js 18+
- Platform-specific Tauri dependencies

### Build Commands

```bash
# Install dependencies
npm install

# Development mode with hot reload
npm run dev

# Production build
npm run build

# Tauri development
npm run tauri dev

# Create distributables
npm run tauri build
```

### Network Permissions

The application requires raw socket access for ARP packet generation. On most systems this works without elevation, but some configurations may require administrator privileges.

## Planned Features

- **Port Scanner**: TCP/UDP port enumeration for discovered devices
- **Network Stress Testing**: Bandwidth and latency testing capabilities
- **Historical Data**: SQLite-based storage for scan history and device tracking

## Technical Notes

The implementation prioritizes safety and cross-platform compatibility. Raw networking operations use safe Rust abstractions, and all network I/O is handled asynchronously to prevent UI blocking. The embedded OUI database ensures manufacturer lookups work offline.

Error handling covers common network scenarios including interface detection failures, packet transmission errors, and DNS resolution timeouts. The application gracefully degrades when network operations fail, providing meaningful error messages to users.