// TypeScript types mirroring the Rust stresser module

export enum TestType {
  PingFlood = "PingFlood",
  BandwidthTest = "BandwidthTest",
  LatencyTest = "LatencyTest",
  PacketLoss = "PacketLoss",
}

export enum Intensity {
  Low = "Low",      // 10 pps
  Medium = "Medium", // 50 pps
  High = "High",    // 100 pps
}

export enum TestStatus {
  Idle = "Idle",
  Running = "Running",
  Paused = "Paused",
  Completed = "Completed",
  Failed = "Failed",
}

export interface TestMetrics {
  latency_ms: number;
  packet_loss_percentage: number;
  throughput_mbps: number;
  jitter_ms: number;
  packets_sent: number;
  packets_received: number;
  timestamp: number;
}

export interface TestResult {
  test_id: string;
  target_ip: string;
  test_type: TestType;
  intensity: Intensity;
  duration_seconds: number;
  start_time: number;
  end_time?: number;
  final_metrics?: TestMetrics;
  status: TestStatus;
  error_message?: string;
}

export interface StressTestConfig {
  target_ip: string;
  test_type: TestType;
  intensity: Intensity;
  duration_seconds: number;
}

// UI-specific types
export interface StressTestFormData {
  targetIp: string;
  testType: TestType;
  intensity: Intensity;
  duration: number; // in seconds
}

export interface SafetyConfirmation {
  acknowledgeResponsibleUse: boolean;
  acknowledgePrivateNetworkOnly: boolean;
  acknowledgeNoMaliciousIntent: boolean;
  acknowledgeUserResponsibility: boolean;
  acknowledgeEmergencyStop: boolean;
}

// Error types
export type StressError =
  | "InvalidTargetIp"
  | "TestAlreadyRunning"
  | "RateLimitExceeded"
  | "DurationTooLong"
  | "CooldownActive"
  | "ResourceLimitExceeded"
  | "NetworkError"
  | "DeadMansSwitchTriggered"
  | "UserCancelled"
  | "InternalError";

// Event types for real-time updates
export interface StressTestUpdateEvent {
  metrics: TestMetrics;
  status: TestStatus;
}

// Utility types
export interface IntensityInfo {
  packetsPerSecond: number;
  description: string;
  riskLevel: "low" | "medium" | "high";
}

export const INTENSITY_INFO: Record<Intensity, IntensityInfo> = {
  [Intensity.Low]: {
    packetsPerSecond: 10,
    description: "Low intensity - suitable for basic connectivity testing",
    riskLevel: "low",
  },
  [Intensity.Medium]: {
    packetsPerSecond: 50,
    description: "Medium intensity - moderate network stress testing",
    riskLevel: "medium",
  },
  [Intensity.High]: {
    packetsPerSecond: 100,
    description: "High intensity - aggressive stress testing",
    riskLevel: "high",
  },
};

export interface TestTypeInfo {
  name: string;
  description: string;
  primaryMetric: keyof TestMetrics;
  icon: string;
}

export const TEST_TYPE_INFO: Record<TestType, TestTypeInfo> = {
  [TestType.PingFlood]: {
    name: "Ping Flood",
    description: "Rapid ICMP echo requests to test device responsiveness",
    primaryMetric: "latency_ms",
    icon: "Zap",
  },
  [TestType.BandwidthTest]: {
    name: "Bandwidth Test",
    description: "Network throughput and capacity testing",
    primaryMetric: "throughput_mbps",
    icon: "Activity",
  },
  [TestType.LatencyTest]: {
    name: "Latency Test",
    description: "Precise round-trip time measurements",
    primaryMetric: "latency_ms",
    icon: "Clock",
  },
  [TestType.PacketLoss]: {
    name: "Packet Loss Test",
    description: "Network reliability and packet delivery testing",
    primaryMetric: "packet_loss_percentage",
    icon: "AlertTriangle",
  },
};

// Safety limits constants
export const SAFETY_LIMITS = {
  MAX_PACKETS_PER_SECOND: 1000,
  MAX_DURATION_SECONDS: 300,
  MIN_COOLDOWN_SECONDS: 5,
  MAX_CPU_PERCENT: 80.0,
  MAX_MEMORY_PERCENT: 70.0,
  DEAD_MANS_SWITCH_INTERVAL_SECONDS: 30,
} as const;

// Helper functions
export function getIntensityPacketsPerSecond(intensity: Intensity): number {
  return INTENSITY_INFO[intensity].packetsPerSecond;
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
}

export function formatMetricValue(metric: keyof TestMetrics, value: number): string {
  switch (metric) {
    case "latency_ms":
    case "jitter_ms":
      return `${value.toFixed(2)} ms`;
    case "packet_loss_percentage":
      return `${value.toFixed(1)}%`;
    case "throughput_mbps":
      return `${value.toFixed(3)} Mbps`;
    case "packets_sent":
    case "packets_received":
      return value.toString();
    case "timestamp":
      return new Date(value).toLocaleTimeString();
    default:
      return value.toString();
  }
}

export function isPrivateIp(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(part => isNaN(part) || part < 0 || part > 255)) {
    return false;
  }

  const [a, b] = parts;

  // 10.0.0.0/8
  if (a === 10) return true;

  // 172.16.0.0/12
  if (a === 172 && b >= 16 && b <= 31) return true;

  // 192.168.0.0/16
  if (a === 192 && b === 168) return true;

  return false;
}

export function validateStressTestConfig(config: StressTestFormData): string[] {
  const errors: string[] = [];

  // Validate IP
  if (!config.targetIp.trim()) {
    errors.push("Target IP is required");
  } else if (!isPrivateIp(config.targetIp)) {
    errors.push("Target IP must be in a private network range (10.x.x.x, 192.168.x.x, or 172.16-31.x.x)");
  }

  // Validate duration
  if (config.duration <= 0) {
    errors.push("Duration must be greater than 0");
  } else if (config.duration > SAFETY_LIMITS.MAX_DURATION_SECONDS) {
    errors.push(`Duration cannot exceed ${SAFETY_LIMITS.MAX_DURATION_SECONDS} seconds`);
  }

  return errors;
}