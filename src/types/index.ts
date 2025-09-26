// src/types/index.ts
export interface Device {
  ip_address: string;
  mac_address: string;
  manufacturer: string;
  hostname: string;
}

// Re-export stresser types
export * from './stresser';


