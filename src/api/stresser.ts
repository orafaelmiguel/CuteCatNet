import { invoke } from "@tauri-apps/api/core";
import {
  StressTestConfig,
  TestStatus,
  TestMetrics,
  TestResult,
  StressError,
} from "@/types/stresser";

// Custom error class for stress test operations
export class StressTestError extends Error {
  constructor(public errorType: StressError, message: string) {
    super(message);
    this.name = "StressTestError";
  }
}

// Retry configuration
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 100,
  maxDelay: 1000,
};

// Helper function for retrying critical operations
async function withRetry<T>(
  operation: () => Promise<T>,
  retries = RETRY_CONFIG.maxRetries
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (retries > 0) {
      const delay = Math.min(
        RETRY_CONFIG.baseDelay * (RETRY_CONFIG.maxRetries - retries + 1),
        RETRY_CONFIG.maxDelay
      );
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(operation, retries - 1);
    }
    throw error;
  }
}

// Validation API
export async function validateStressTarget(ip: string): Promise<boolean> {
  try {
    const isValid = await invoke<boolean>("validate_stress_target", { ip });
    return isValid;
  } catch (error) {
    console.error("Failed to validate stress target:", error);
    throw new StressTestError("InvalidTargetIp", `Invalid target IP: ${error}`);
  }
}

// Test management API
export async function startStressTest(config: StressTestConfig): Promise<string> {
  try {
    const testId = await withRetry(async () => {
      return await invoke<string>("start_stress_test", { config });
    });
    console.log(`Started stress test: ${testId}`);
    return testId;
  } catch (error) {
    console.error("Failed to start stress test:", error);

    // Parse the error message to determine the error type
    const errorMessage = error as string;
    let errorType: StressError = "InternalError";

    if (errorMessage.includes("Target IP is not in a private network")) {
      errorType = "InvalidTargetIp";
    } else if (errorMessage.includes("Test already running")) {
      errorType = "TestAlreadyRunning";
    } else if (errorMessage.includes("Rate limit exceeded")) {
      errorType = "RateLimitExceeded";
    } else if (errorMessage.includes("Test duration too long")) {
      errorType = "DurationTooLong";
    } else if (errorMessage.includes("Cooldown period active")) {
      errorType = "CooldownActive";
    } else if (errorMessage.includes("Resource limit exceeded")) {
      errorType = "ResourceLimitExceeded";
    } else if (errorMessage.includes("Dead man's switch")) {
      errorType = "DeadMansSwitchTriggered";
    } else if (errorMessage.includes("Network error")) {
      errorType = "NetworkError";
    }

    throw new StressTestError(errorType, errorMessage);
  }
}

export async function stopStressTest(): Promise<void> {
  try {
    await withRetry(async () => {
      await invoke<void>("stop_stress_test");
    });
    console.log("Stress test stopped");
  } catch (error) {
    console.error("Failed to stop stress test:", error);
    throw new StressTestError("InternalError", `Failed to stop test: ${error}`);
  }
}

// Status and metrics API
export async function getStressTestStatus(): Promise<TestStatus> {
  try {
    return await invoke<TestStatus>("get_stress_test_status");
  } catch (error) {
    console.error("Failed to get stress test status:", error);
    throw new StressTestError("InternalError", `Failed to get status: ${error}`);
  }
}

export async function getStressTestMetrics(): Promise<TestMetrics> {
  try {
    return await invoke<TestMetrics>("get_stress_test_metrics");
  } catch (error) {
    console.error("Failed to get stress test metrics:", error);
    throw new StressTestError("InternalError", `Failed to get metrics: ${error}`);
  }
}

export async function getCurrentStressTest(): Promise<TestResult | null> {
  try {
    return await invoke<TestResult | null>("get_current_stress_test");
  } catch (error) {
    console.error("Failed to get current stress test:", error);
    throw new StressTestError("InternalError", `Failed to get current test: ${error}`);
  }
}

// Dead man's switch API
export async function confirmStressAlive(): Promise<void> {
  try {
    await invoke<void>("confirm_stress_alive");
  } catch (error) {
    console.error("Failed to confirm stress alive:", error);
    // Don't throw here as this is called frequently
  }
}

// Higher-level API functions
export class StressTestApi {
  private static instance: StressTestApi;
  private deadMansInterval: NodeJS.Timeout | null = null;

  private constructor() {}

  public static getInstance(): StressTestApi {
    if (!StressTestApi.instance) {
      StressTestApi.instance = new StressTestApi();
    }
    return StressTestApi.instance;
  }

  // Start a stress test with automatic dead man's switch
  async startTest(config: StressTestConfig): Promise<string> {
    const testId = await startStressTest(config);
    this.startDeadMansSwitch();
    return testId;
  }

  // Stop the current test and clean up
  async stopTest(): Promise<void> {
    await stopStressTest();
    this.stopDeadMansSwitch();
  }

  // Emergency stop - force stop everything
  async emergencyStop(): Promise<void> {
    try {
      await this.stopTest();
    } catch (error) {
      console.error("Emergency stop failed:", error);
    }
    this.stopDeadMansSwitch();
  }

  // Get comprehensive test information
  async getTestInfo(): Promise<{
    status: TestStatus;
    metrics: TestMetrics;
    currentTest: TestResult | null;
  }> {
    const [status, metrics, currentTest] = await Promise.all([
      getStressTestStatus(),
      getStressTestMetrics(),
      getCurrentStressTest(),
    ]);

    return { status, metrics, currentTest };
  }

  // Dead man's switch management
  private startDeadMansSwitch(): void {
    this.stopDeadMansSwitch(); // Clear any existing interval

    // Confirm alive every 15 seconds (half the server timeout)
    this.deadMansInterval = setInterval(async () => {
      try {
        await confirmStressAlive();
      } catch (error) {
        console.error("Dead man's switch confirmation failed:", error);
      }
    }, 15000);
  }

  private stopDeadMansSwitch(): void {
    if (this.deadMansInterval) {
      clearInterval(this.deadMansInterval);
      this.deadMansInterval = null;
    }
  }

  // Validate configuration before starting
  async validateConfiguration(config: StressTestConfig): Promise<{
    isValid: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];

    try {
      const isValidTarget = await validateStressTarget(config.target_ip);
      if (!isValidTarget) {
        errors.push("Invalid target IP address");
      }
    } catch (error) {
      if (error instanceof StressTestError) {
        errors.push(error.message);
      } else {
        errors.push("Failed to validate target IP");
      }
    }

    // Additional client-side validations
    if (config.duration_seconds <= 0) {
      errors.push("Duration must be greater than 0");
    }

    if (config.duration_seconds > 300) {
      errors.push("Duration cannot exceed 300 seconds");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  // Check if a test can be started
  async canStartTest(): Promise<{
    canStart: boolean;
    reason?: string;
  }> {
    try {
      const status = await getStressTestStatus();

      if (status === TestStatus.Running) {
        return {
          canStart: false,
          reason: "A stress test is already running",
        };
      }

      return { canStart: true };
    } catch (error) {
      return {
        canStart: false,
        reason: "Failed to check test status",
      };
    }
  }
}

// Export singleton instance
export const stressTestApi = StressTestApi.getInstance();