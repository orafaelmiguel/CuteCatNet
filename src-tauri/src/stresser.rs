use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::net::Ipv4Addr;
use std::sync::Arc;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tokio::sync::{watch, RwLock};
use tokio::time::{interval, timeout};
use thiserror::Error;
use log::{debug, info, warn, error};

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub enum TestType {
    PingFlood,
    BandwidthTest,
    LatencyTest,
    PacketLoss,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub enum Intensity {
    Low,    // 10 pps
    Medium, // 50 pps
    High,   // 100 pps
}

impl Intensity {
    pub fn to_packets_per_second(&self) -> u32 {
        match self {
            Intensity::Low => 10,
            Intensity::Medium => 50,
            Intensity::High => 100,
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub enum TestStatus {
    Idle,
    Running,
    Paused,
    Completed,
    Failed,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct TestMetrics {
    pub latency_ms: f64,
    pub packet_loss_percentage: f64,
    pub throughput_mbps: f64,
    pub jitter_ms: f64,
    pub packets_sent: u32,
    pub packets_received: u32,
    pub timestamp: u64,
}

impl Default for TestMetrics {
    fn default() -> Self {
        Self {
            latency_ms: 0.0,
            packet_loss_percentage: 0.0,
            throughput_mbps: 0.0,
            jitter_ms: 0.0,
            packets_sent: 0,
            packets_received: 0,
            timestamp: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_millis() as u64,
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct TestResult {
    pub test_id: String,
    pub target_ip: String,
    pub test_type: TestType,
    pub intensity: Intensity,
    pub duration_seconds: u32,
    pub start_time: u64,
    pub end_time: Option<u64>,
    pub final_metrics: Option<TestMetrics>,
    pub status: TestStatus,
    pub error_message: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct StressTestConfig {
    pub target_ip: String,
    pub test_type: TestType,
    pub intensity: Intensity,
    pub duration_seconds: u32,
}

#[derive(Error, Debug)]
pub enum StressError {
    #[error("Target IP is not in a private network range")]
    InvalidTargetIp,
    #[error("Test already running. Only one test allowed at a time")]
    TestAlreadyRunning,
    #[error("Rate limit exceeded. Maximum 1000 pps allowed")]
    RateLimitExceeded,
    #[error("Test duration too long. Maximum 300 seconds allowed")]
    DurationTooLong,
    #[error("Cooldown period active. Wait {0} seconds before testing this target again")]
    CooldownActive(u64),
    #[error("System resource limit exceeded: {0}")]
    ResourceLimitExceeded(String),
    #[error("Network error: {0}")]
    NetworkError(String),
    #[error("Dead man's switch triggered - UI confirmation required")]
    DeadMansSwitchTriggered,
    #[error("Test cancelled by user")]
    UserCancelled,
    #[error("Internal error: {0}")]
    InternalError(String),
}

#[derive(Clone)]
pub struct SafetyLimits {
    pub max_packets_per_second: u32,
    pub max_duration_seconds: u32,
    pub min_cooldown_seconds: u64,
    pub max_cpu_percent: f32,
    pub max_memory_percent: f32,
    pub dead_mans_switch_interval_seconds: u32,
}

impl Default for SafetyLimits {
    fn default() -> Self {
        Self {
            max_packets_per_second: 1000,
            max_duration_seconds: 300,
            min_cooldown_seconds: 5,
            max_cpu_percent: 80.0,
            max_memory_percent: 70.0,
            dead_mans_switch_interval_seconds: 30,
        }
    }
}

pub struct TestState {
    pub current_test: Option<TestResult>,
    pub metrics: TestMetrics,
    pub last_update: Instant,
    pub last_confirmation: Instant,
    pub cooldown_targets: HashMap<String, Instant>,
}

impl Default for TestState {
    fn default() -> Self {
        Self {
            current_test: None,
            metrics: TestMetrics::default(),
            last_update: Instant::now(),
            last_confirmation: Instant::now(),
            cooldown_targets: HashMap::new(),
        }
    }
}

#[derive(Clone)]
pub struct StressTestEngine {
    state: Arc<RwLock<TestState>>,
    cancel_tx: Option<watch::Sender<bool>>,
    safety_limits: SafetyLimits,
}

impl Default for StressTestEngine {
    fn default() -> Self {
        Self {
            state: Arc::new(RwLock::new(TestState::default())),
            cancel_tx: None,
            safety_limits: SafetyLimits::default(),
        }
    }
}

impl StressTestEngine {
    pub fn new() -> Self {
        Self::default()
    }

    pub async fn validate_target_ip(&self, ip: &str) -> Result<(), StressError> {
        let parsed_ip: Ipv4Addr = ip.parse()
            .map_err(|_| StressError::InvalidTargetIp)?;

        // Only allow private network ranges for safety
        if !is_private_ip(&parsed_ip) {
            return Err(StressError::InvalidTargetIp);
        }

        Ok(())
    }

    pub async fn validate_test_config(&self, config: &StressTestConfig) -> Result<(), StressError> {
        // Validate target IP
        self.validate_target_ip(&config.target_ip).await?;

        // Check rate limits
        if config.intensity.to_packets_per_second() > self.safety_limits.max_packets_per_second {
            return Err(StressError::RateLimitExceeded);
        }

        // Check duration
        if config.duration_seconds > self.safety_limits.max_duration_seconds {
            return Err(StressError::DurationTooLong);
        }

        // Check if test is already running
        {
            let state = self.state.read().await;
            if let Some(test) = &state.current_test {
                if test.status == TestStatus::Running {
                    return Err(StressError::TestAlreadyRunning);
                }
            }
        }

        // Check cooldown
        {
            let state = self.state.read().await;
            if let Some(last_test_time) = state.cooldown_targets.get(&config.target_ip) {
                let cooldown_duration = Duration::from_secs(self.safety_limits.min_cooldown_seconds);
                if last_test_time.elapsed() < cooldown_duration {
                    let remaining = cooldown_duration.as_secs() - last_test_time.elapsed().as_secs();
                    return Err(StressError::CooldownActive(remaining));
                }
            }
        }

        Ok(())
    }

    pub async fn start_stress_test(&mut self, config: StressTestConfig) -> Result<String, StressError> {
        // Validate configuration
        self.validate_test_config(&config).await?;

        // Check system resources
        self.check_system_resources().await?;

        let test_id = generate_test_id();
        let test_result = TestResult {
            test_id: test_id.clone(),
            target_ip: config.target_ip.clone(),
            test_type: config.test_type.clone(),
            intensity: config.intensity.clone(),
            duration_seconds: config.duration_seconds,
            start_time: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_millis() as u64,
            end_time: None,
            final_metrics: None,
            status: TestStatus::Running,
            error_message: None,
        };

        // Create cancellation channel
        let (cancel_tx, cancel_rx) = watch::channel(false);
        self.cancel_tx = Some(cancel_tx);

        // Initialize test state
        {
            let mut state = self.state.write().await;
            state.current_test = Some(test_result);
            state.metrics = TestMetrics::default();
            state.last_update = Instant::now();
            state.last_confirmation = Instant::now();
            state.cooldown_targets.insert(config.target_ip.clone(), Instant::now());
        }

        // Start the stress test engine
        let state_clone = Arc::clone(&self.state);
        let config_clone = config.clone();
        let safety_limits = self.safety_limits.clone();

        tokio::spawn(async move {
            let state_for_error = Arc::clone(&state_clone);
            if let Err(e) = run_stress_test_loop(state_clone, config_clone, cancel_rx, safety_limits).await {
                error!("Stress test failed: {}", e);
                // Update state with error
                if let Ok(mut state) = state_for_error.try_write() {
                    if let Some(ref mut test) = state.current_test {
                        test.status = TestStatus::Failed;
                        test.error_message = Some(e.to_string());
                        test.end_time = Some(
                            SystemTime::now()
                                .duration_since(UNIX_EPOCH)
                                .unwrap()
                                .as_millis() as u64
                        );
                    }
                }
            }
        });

        info!("Started stress test {} for target {}", test_id, config.target_ip);
        Ok(test_id)
    }

    async fn check_system_resources(&self) -> Result<(), StressError> {
        // Simple resource check - in production this would use actual system monitoring
        // For now, we'll just check if we have reasonable limits
        if cfg!(debug_assertions) {
            debug!("Resource check passed (debug mode)");
        }
        Ok(())
    }

    pub async fn get_current_status(&self) -> TestStatus {
        let state = self.state.read().await;
        match &state.current_test {
            Some(test) => test.status.clone(),
            None => TestStatus::Idle,
        }
    }

    pub async fn get_current_metrics(&self) -> TestMetrics {
        let state = self.state.read().await;
        state.metrics.clone()
    }

    pub async fn get_current_test(&self) -> Option<TestResult> {
        let state = self.state.read().await;
        state.current_test.clone()
    }

    pub async fn check_dead_mans_switch(&self) -> Result<(), StressError> {
        let state = self.state.read().await;
        let switch_interval = Duration::from_secs(self.safety_limits.dead_mans_switch_interval_seconds as u64);

        if state.last_confirmation.elapsed() > switch_interval {
            return Err(StressError::DeadMansSwitchTriggered);
        }

        Ok(())
    }

    pub async fn confirm_alive(&self) {
        let mut state = self.state.write().await;
        state.last_confirmation = Instant::now();
        debug!("Dead man's switch confirmed");
    }

    pub async fn stop_current_test(&self) -> Result<(), StressError> {
        if let Some(tx) = &self.cancel_tx {
            let _ = tx.send(true);
        }

        let mut state = self.state.write().await;
        let final_metrics = state.metrics.clone();
        if let Some(ref mut test) = state.current_test {
            test.status = TestStatus::Completed;
            test.end_time = Some(
                SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap()
                    .as_millis() as u64
            );
            test.final_metrics = Some(final_metrics);
        }

        info!("Stress test stopped by user");
        Ok(())
    }
}

async fn run_stress_test_loop(
    state: Arc<RwLock<TestState>>,
    config: StressTestConfig,
    mut cancel_rx: watch::Receiver<bool>,
    safety_limits: SafetyLimits,
) -> Result<(), StressError> {
    let target_ip: Ipv4Addr = config.target_ip.parse()
        .map_err(|_| StressError::InvalidTargetIp)?;

    let packets_per_second = config.intensity.to_packets_per_second();
    let mut interval_timer = interval(Duration::from_millis(1000 / packets_per_second as u64));

    let start_time = Instant::now();
    let test_duration = Duration::from_secs(config.duration_seconds as u64);

    let mut packets_sent = 0u32;
    let mut packets_received = 0u32;
    let mut latencies = Vec::new();

    info!("Starting stress test loop for {} with {} pps", target_ip, packets_per_second);

    loop {
        tokio::select! {
            _ = interval_timer.tick() => {
                // Check if test should continue
                if start_time.elapsed() >= test_duration {
                    break;
                }

                // Check for cancellation
                if *cancel_rx.borrow() {
                    info!("Stress test cancelled by user");
                    return Err(StressError::UserCancelled);
                }

                // Check dead man's switch
                {
                    let state_read = state.read().await;
                    let switch_interval = Duration::from_secs(safety_limits.dead_mans_switch_interval_seconds as u64);
                    if state_read.last_confirmation.elapsed() > switch_interval {
                        warn!("Dead man's switch triggered");
                        return Err(StressError::DeadMansSwitchTriggered);
                    }
                }

                // Perform stress test operation based on type
                match config.test_type {
                    TestType::PingFlood | TestType::LatencyTest => {
                        if let Ok(latency) = send_ping(&target_ip).await {
                            packets_received += 1;
                            latencies.push(latency);
                        }
                        packets_sent += 1;
                    },
                    TestType::BandwidthTest => {
                        // For bandwidth test, we'd send larger packets
                        if let Ok(latency) = send_ping(&target_ip).await {
                            packets_received += 1;
                            latencies.push(latency);
                        }
                        packets_sent += 1;
                    },
                    TestType::PacketLoss => {
                        // Similar to ping but focused on loss measurement
                        if let Ok(latency) = send_ping(&target_ip).await {
                            packets_received += 1;
                            latencies.push(latency);
                        }
                        packets_sent += 1;
                    },
                }

                // Update metrics every 100ms
                if packets_sent % (packets_per_second / 10).max(1) == 0 {
                    let mut state_write = state.write().await;
                    update_metrics(&mut state_write.metrics, packets_sent, packets_received, &latencies);
                    state_write.last_update = Instant::now();
                }

                // Circuit breaker - stop if packet loss is too high
                if packets_sent > 100 && (packets_received as f64 / packets_sent as f64) < 0.1 {
                    warn!("Circuit breaker triggered - high packet loss detected");
                    break;
                }
            }

            _ = cancel_rx.changed() => {
                if *cancel_rx.borrow() {
                    info!("Stress test cancelled");
                    return Err(StressError::UserCancelled);
                }
            }
        }
    }

    // Finalize test
    {
        let mut state_write = state.write().await;
        update_metrics(&mut state_write.metrics, packets_sent, packets_received, &latencies);

        let final_metrics = state_write.metrics.clone();
        if let Some(ref mut test) = state_write.current_test {
            test.status = TestStatus::Completed;
            test.end_time = Some(
                SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap()
                    .as_millis() as u64
            );
            test.final_metrics = Some(final_metrics);
        }
    }

    info!("Stress test completed. Sent: {}, Received: {}", packets_sent, packets_received);
    Ok(())
}

async fn send_ping(_target: &Ipv4Addr) -> Result<f64, StressError> {
    // Simplified ping implementation using ICMP
    // In a real implementation, this would use raw sockets or system ping
    let start = Instant::now();

    // Simulate ping with a short timeout
    match timeout(Duration::from_millis(100), std::future::ready(())).await {
        Ok(_) => {
            let latency = start.elapsed().as_secs_f64() * 1000.0;
            Ok(latency)
        },
        Err(_) => Err(StressError::NetworkError("Ping timeout".to_string())),
    }
}

fn update_metrics(metrics: &mut TestMetrics, sent: u32, received: u32, latencies: &[f64]) {
    metrics.packets_sent = sent;
    metrics.packets_received = received;

    if sent > 0 {
        metrics.packet_loss_percentage = ((sent - received) as f64 / sent as f64) * 100.0;
    }

    if !latencies.is_empty() {
        metrics.latency_ms = latencies.iter().sum::<f64>() / latencies.len() as f64;

        // Calculate jitter (standard deviation of latencies)
        let mean = metrics.latency_ms;
        let variance = latencies.iter()
            .map(|&x| (x - mean).powi(2))
            .sum::<f64>() / latencies.len() as f64;
        metrics.jitter_ms = variance.sqrt();
    }

    // Simple throughput calculation (packets/sec converted to approximate Mbps)
    metrics.throughput_mbps = (received as f64) * 0.001; // Very rough estimate

    metrics.timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64;
}

fn is_private_ip(ip: &Ipv4Addr) -> bool {
    let octets = ip.octets();

    // 10.0.0.0/8
    if octets[0] == 10 {
        return true;
    }

    // 172.16.0.0/12
    if octets[0] == 172 && (octets[1] >= 16 && octets[1] <= 31) {
        return true;
    }

    // 192.168.0.0/16
    if octets[0] == 192 && octets[1] == 168 {
        return true;
    }

    false
}

fn generate_test_id() -> String {
    format!("test_{}",
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis()
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_private_ip_validation() {
        assert!(is_private_ip(&"10.0.0.1".parse().unwrap()));
        assert!(is_private_ip(&"192.168.1.1".parse().unwrap()));
        assert!(is_private_ip(&"172.16.0.1".parse().unwrap()));
        assert!(is_private_ip(&"172.31.255.255".parse().unwrap()));

        assert!(!is_private_ip(&"8.8.8.8".parse().unwrap()));
        assert!(!is_private_ip(&"1.1.1.1".parse().unwrap()));
        assert!(!is_private_ip(&"172.32.0.1".parse().unwrap()));
    }

    #[test]
    fn test_intensity_conversion() {
        assert_eq!(Intensity::Low.to_packets_per_second(), 10);
        assert_eq!(Intensity::Medium.to_packets_per_second(), 50);
        assert_eq!(Intensity::High.to_packets_per_second(), 100);
    }

    #[tokio::test]
    async fn test_engine_validation() {
        let engine = StressTestEngine::new();

        // Valid private IP
        assert!(engine.validate_target_ip("192.168.1.1").await.is_ok());

        // Invalid public IP
        assert!(engine.validate_target_ip("8.8.8.8").await.is_err());

        // Invalid IP format
        assert!(engine.validate_target_ip("invalid").await.is_err());
    }
}