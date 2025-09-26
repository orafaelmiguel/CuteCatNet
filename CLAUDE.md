# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture Overview

CuteCatNet is a cross-platform network discovery desktop application built with **Tauri**. It combines a Rust backend for low-level network operations with a React TypeScript frontend for the user interface.

### Tech Stack
- **Backend**: Rust with Tauri for core network scanning logic
- **Frontend**: React + TypeScript + Vite with Tailwind CSS and Shadcn/ui components
- **Build System**: Tauri with Vite for frontend bundling
- **Styling**: Tailwind CSS 3.4.x with Shadcn/ui component library

### Key Components
- **Network Scanner** (`src-tauri/src/scanner.rs`): Core ARP-based network discovery using `pnet` crate
- **OUI Database** (`src-tauri/src/oui_db.rs`): Embedded manufacturer identification from MAC addresses
- **Device Structure**: Consistent `Device` type between Rust backend and TypeScript frontend

## Development Commands

### Frontend Development
```bash
npm run dev          # Start Vite development server
npm run build        # Build frontend (tsc + vite build)
npm run preview      # Preview production build
```

### Tauri Development
```bash
npm run tauri dev    # Start Tauri development mode (frontend + backend)
npm run tauri build  # Build production Tauri application
```

### Backend Development
```bash
cd src-tauri
cargo fmt           # Format Rust code
cargo check         # Check Rust code without building
cargo build         # Build Rust backend
```

## Project Structure

```
├── src/                    # React frontend
│   ├── api/               # Tauri invoke wrappers
│   ├── components/
│   │   ├── ui/           # Shadcn/ui components (added via CLI)
│   │   └── app/          # Application-specific components
│   ├── hooks/            # Custom React hooks
│   ├── lib/              # Utilities (cn function, etc.)
│   ├── providers/        # React context providers
│   └── types/            # TypeScript type definitions
├── src-tauri/             # Rust backend
│   ├── src/
│   │   ├── scanner.rs    # Network scanning logic
│   │   ├── oui_db.rs     # MAC manufacturer lookup
│   │   ├── lib.rs        # Tauri commands
│   │   └── main.rs       # Application entry point
│   └── Cargo.toml        # Rust dependencies
└── package.json           # Node.js frontend dependencies
```

## Network Scanning Implementation

The core functionality uses ARP (Address Resolution Protocol) scanning to discover devices:

1. **Interface Detection**: Uses `default-net` crate to find active network interface
2. **Network Enumeration**: Calculates CIDR network range from interface configuration
3. **ARP Request Generation**: Creates raw ARP packets using `pnet` crate for each IP
4. **Response Processing**: Asynchronously processes ARP replies to extract device information
5. **Manufacturer Resolution**: Maps MAC addresses to manufacturers using embedded OUI database

### Device Type Structure
```rust
// Rust (src-tauri/src/scanner.rs)
#[derive(Serialize, Clone, Debug)]
pub struct Device {
    ip_address: String,
    mac_address: String,
    manufacturer: String,
    hostname: String,
}
```

```typescript
// TypeScript (src/types/index.ts)
interface Device {
  ip_address: string;
  mac_address: string;
  manufacturer: string;
  hostname: string;
}
```

## Tauri Commands

- `scan_network()`: Performs ARP scan and returns `Vec<Device>`

## Dependencies and Requirements

### Windows Prerequisites
- **Npcap**: Required for packet capture on Windows. Install from https://nmap.org/npcap/ with "WinPcap API-compatible Mode" enabled.

### Key Rust Dependencies
- `tauri`: Application framework
- `pnet`: Raw packet manipulation and network interfaces
- `default-net`: Network interface discovery
- `ipnetwork`: IP address and network calculations
- `dns-lookup`: Hostname resolution
- `tokio`: Async runtime

### Key Frontend Dependencies
- React 19+ with TypeScript
- Tailwind CSS 3.4.x (strict version requirement)
- Shadcn/ui components (installed via CLI: `npx shadcn-ui@latest add [component]`)
- Lucide React icons

## Development Rules

### Code Style
- **Rust**: Use `cargo fmt` for formatting, follow snake_case for functions/variables
- **TypeScript**: Strict typing required, no `any` types allowed
- **React**: Use functional components with hooks, camelCase naming

### Component Architecture
- Use Shadcn/ui as base components, customize locally in `src/components/ui/`
- Application components in `src/components/app/`
- State management via React hooks and Context API for theme

### Theme System
- Light/dark theme controlled via CSS variables in `src/index.css`
- Theme persistence in localStorage
- Colors use Tailwind utilities that map to CSS custom properties

### Error Handling
- Rust backend: Never panic, return `Result<T, String>` for Tauri commands
- Frontend: Always use try/catch when calling `invoke()`, manage loading/error states

## Network Permissions
Raw socket access may require administrator privileges on some systems. The application gracefully handles permission errors and provides meaningful error messages.