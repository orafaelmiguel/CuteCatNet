# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CuteCatNet is a cross-platform desktop network scanner application built with Tauri. It combines a Rust backend for network operations with a React TypeScript frontend. The application performs ARP scans to discover devices on the local network and presents them in a clean, modern interface.

**Ethos**: "Exploring networks in a cute way" - professional and clean UI with subtle cat-themed elements.

## Architecture

- **Backend (Rust)**: Located in `src-tauri/`, handles all network scanning, device discovery, and low-level operations
- **Frontend (React + TypeScript)**: Located in `src/`, provides the user interface using Tauri's webview
- **Communication**: Frontend calls Rust functions via Tauri's `invoke` API
- **Database**: SQLite (prepared for future versions, not actively used in MVP)

### Key Technologies
- **Backend**: Tauri, pnet (network), ipnetwork, tokio (async), serde (serialization)
- **Frontend**: React 18+, TypeScript, Vite, Tailwind CSS 3.4.x, Shadcn/ui components
- **Icons**: Lucide React (only source for icons)
- **Styling**: CSS variables for theming, supports light/dark modes

## Development Commands

```bash
# Install dependencies
npm install

# Development mode (starts both frontend and backend)
npm run dev

# Build for production
npm run build

# Preview built application
npm run preview

# Tauri commands
npm run tauri dev    # Development with hot reload
npm run tauri build  # Build distributable
```

## Project Structure

```
src/
├── api/                # Functions wrapping `invoke` calls to Rust
├── components/
│   ├── ui/             # Pure Shadcn/ui components (added via CLI)
│   └── app/            # Application-specific composed components
├── hooks/              # Custom React hooks
├── lib/
│   └── utils.ts        # Utility functions (cn for clsx + tailwind-merge)
├── providers/          # React context providers (ThemeProvider)
├── types/
│   └── index.ts        # Global TypeScript definitions
├── App.tsx             # Root component
└── main.tsx            # React entry point

src-tauri/
├── src/
│   ├── main.rs         # Tauri application entry point
│   ├── lib.rs          # Default Tauri lib (minimal usage)
│   ├── scanner.rs      # Network scanning logic
│   └── oui_db.rs       # MAC address vendor lookup
└── tauri.conf.json     # Tauri configuration
```

## Core Data Types

### Device Interface (Frontend & Backend)
```typescript
interface Device {
  ip_address: string;
  mac_address: string;
  manufacturer: string;
  hostname: string;
}
```

### Rust Equivalent
```rust
#[derive(serde::Serialize, Clone, Debug)]
pub struct Device {
    ip_address: String,
    mac_address: String,
    manufacturer: String,
    hostname: String,
}
```

## Development Guidelines

### Code Style
- **No comments in code** (per project rules)
- **English only** for all code, variables, and functions
- Use `cargo fmt` for Rust formatting
- Use Prettier + ESLint for TypeScript/React
- **Naming conventions**:
  - Rust: `snake_case` for variables/functions, `PascalCase` for structs/enums
  - TypeScript: `camelCase` for variables/functions, `PascalCase` for components/interfaces

### State Management
- State managed in `App.tsx` component for MVP
- Essential states: `devices`, `isLoading`, `error`, `theme`
- Theme managed via Context API (`ThemeProvider`)
- Persist theme preference in `localStorage`

### Error Handling Pattern
```typescript
const handleScan = async () => {
    setIsLoading(true);
    setError(null);
    try {
        const result = await invoke<Device[]>('scan_network');
        setDevices(result);
    } catch (err: unknown) {
        setError(err instanceof Error ? err.message : String(err));
    } finally {
        setIsLoading(false);
    }
};
```

### Component Guidelines
- Use Shadcn/ui components as base building blocks
- Add components via `npx shadcn@latest add [component-name]`
- All interactions should have smooth transitions
- Support both light and dark themes using CSS variables
- Responsive design for different window sizes

### Rust Backend
- All functions exposed to frontend must be async
- Use `Result<T, String>` for error handling
- Never use `panic!` - always return errors gracefully
- Network operations should be non-blocking
- All Tauri commands marked with `#[tauri::command]`

## Common Tauri Commands

- `scan_network()` - Performs ARP scan and returns list of discovered devices

## Theming

Colors are controlled via CSS variables in `src/index.css`. The application supports light and dark themes with the `.dark` class applied to the root element. Use Tailwind's color utilities that map to these CSS variables (e.g., `bg-background`, `text-primary`, `border-border`).