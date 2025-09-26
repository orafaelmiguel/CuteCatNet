import { useState, useEffect } from 'react';
import {
  Activity,
  AlertTriangle,
  Clock,
  Play,
  Square,
  Zap,
  Shield,
  Target,
  Timer,
  TrendingUp,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  TestType,
  Intensity,
  TestStatus,
  StressTestFormData,
  INTENSITY_INFO,
  TEST_TYPE_INFO,
  formatMetricValue,
  formatDuration,
  validateStressTestConfig,
} from '@/types/stresser';
import { useStresser } from '@/providers/stresser-provider';

interface StressTestInterfaceProps {
  onEmergencyStop: () => void;
}

const iconMap = {
  Zap,
  Activity,
  Clock,
  AlertTriangle,
} as const;

export function StressTestInterface({ onEmergencyStop }: StressTestInterfaceProps) {
  const { state, actions } = useStresser();
  const [formData, setFormData] = useState<StressTestFormData>({
    targetIp: '',
    testType: TestType.PingFlood,
    intensity: Intensity.Low,
    duration: 30,
  });
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);


  // Calculate progress for running test
  useEffect(() => {
    if (state.currentTest && state.status === TestStatus.Running) {
      const elapsed = Date.now() - state.currentTest.start_time;
      const total = state.currentTest.duration_seconds * 1000;
      setProgress(Math.min((elapsed / total) * 100, 100));
    } else {
      setProgress(0);
    }
  }, [state.currentTest, state.status, state.metrics.timestamp]);

  // ESC key listener for emergency stop
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && state.status === TestStatus.Running) {
        event.preventDefault();
        onEmergencyStop();
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [state.status, onEmergencyStop]);

  const handleFormSubmit = () => {
    // Basic validation
    const errors: string[] = [];

    if (!formData.targetIp) {
      errors.push('Target IP is required');
    } else if (!/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(formData.targetIp)) {
      errors.push('Please enter a valid IP address');
    }

    if (!formData.duration || formData.duration < 1 || formData.duration > 300) {
      errors.push('Duration must be between 1 and 300 seconds');
    }

    // Validate configuration
    const configErrors = validateStressTestConfig(formData);
    errors.push(...configErrors);

    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    setValidationErrors([]);
    actions.startTest(formData);
  };

  const handleStopTest = () => {
    actions.stopTest();
  };

  const canStartTest = state.status === TestStatus.Idle && state.safetyConfirmed && !state.isLoading;
  const isTestRunning = state.status === TestStatus.Running;

  const getTestTypeIcon = (testType: TestType) => {
    const iconName = TEST_TYPE_INFO[testType].icon as keyof typeof iconMap;
    const IconComponent = iconMap[iconName];
    return IconComponent ? <IconComponent className="h-4 w-4" /> : <Activity className="h-4 w-4" />;
  };

  const getIntensityColor = (intensity: Intensity) => {
    const riskLevel = INTENSITY_INFO[intensity].riskLevel;
    switch (riskLevel) {
      case 'low': return 'text-green-600 dark:text-green-400';
      case 'medium': return 'text-yellow-600 dark:text-yellow-400';
      case 'high': return 'text-red-600 dark:text-red-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  return (
    <div className="space-y-6">
      {/* Test Configuration */}
      {!isTestRunning && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Test Configuration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => { e.preventDefault(); handleFormSubmit(); }} className="space-y-4">
              {/* Target IP */}
              <div className="space-y-2">
                <Label htmlFor="targetIp">Target IP Address</Label>
                <Input
                  id="targetIp"
                  placeholder="192.168.1.1"
                  value={formData.targetIp}
                  onChange={(e) => setFormData(prev => ({ ...prev, targetIp: e.target.value }))}
                />
              </div>

              {/* Test Type */}
              <div className="space-y-2">
                <Label htmlFor="testType">Test Type</Label>
                <Select value={formData.testType} onValueChange={(value) => {
                  setFormData(prev => ({ ...prev, testType: value as TestType }));
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select test type" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(TestType).map((type) => (
                      <SelectItem key={type} value={type}>
                        <div className="flex items-center gap-2">
                          {getTestTypeIcon(type)}
                          <span>{TEST_TYPE_INFO[type].name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  {TEST_TYPE_INFO[formData.testType].description}
                </p>
              </div>

              {/* Intensity */}
              <div className="space-y-2">
                <Label htmlFor="intensity">Intensity Level</Label>
                <Select value={formData.intensity} onValueChange={(value) => {
                  setFormData(prev => ({ ...prev, intensity: value as Intensity }));
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select intensity" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(Intensity).map((intensity) => (
                      <SelectItem key={intensity} value={intensity}>
                        <div className="flex items-center justify-between w-full">
                          <span className={getIntensityColor(intensity)}>
                            {intensity} ({INTENSITY_INFO[intensity].packetsPerSecond} pps)
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  {INTENSITY_INFO[formData.intensity].description}
                </p>
              </div>

              {/* Duration */}
              <div className="space-y-2">
                <Label htmlFor="duration">Duration (seconds)</Label>
                <Input
                  id="duration"
                  type="number"
                  min="1"
                  max="300"
                  value={formData.duration?.toString() || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, duration: parseInt(e.target.value) || 0 }))}
                />
                <p className="text-sm text-muted-foreground">
                  Test duration: {formatDuration(formData.duration || 0)}
                </p>
              </div>

              {/* Validation Errors */}
              {validationErrors.length > 0 && (
                <Alert className="border-red-500 bg-red-50 dark:bg-red-950">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <AlertDescription>
                    <ul className="list-disc list-inside space-y-1">
                      {validationErrors.map((error, index) => (
                        <li key={index} className="text-red-800 dark:text-red-200">{error}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {/* Error Display */}
              {state.error && (
                <Alert className="border-red-500 bg-red-50 dark:bg-red-950">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-800 dark:text-red-200">
                    {state.error}
                  </AlertDescription>
                </Alert>
              )}

              {/* Safety Warning */}
              {!state.safetyConfirmed && (
                <Alert className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
                  <Shield className="h-4 w-4 text-yellow-600" />
                  <AlertDescription className="text-yellow-800 dark:text-yellow-200">
                    You must complete the safety confirmation before starting any stress tests.
                  </AlertDescription>
                </Alert>
              )}

              {/* Start Button */}
              <Button
                type="submit"
                disabled={!canStartTest}
                className="w-full"
              >
                <Play className="h-4 w-4 mr-2" />
                {state.isLoading ? 'Starting Test...' : 'Start Stress Test'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Running Test Display */}
      {isTestRunning && state.currentTest && (
        <div className="space-y-4">
          {/* Test Progress */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Timer className="h-5 w-5" />
                  Test In Progress
                </div>
                <Button variant="destructive" onClick={handleStopTest} size="sm">
                  <Square className="h-4 w-4 mr-2" />
                  Stop Test
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Target</p>
                  <p className="font-mono">{state.currentTest.target_ip}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Type</p>
                  <p>{TEST_TYPE_INFO[state.currentTest.test_type].name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Intensity</p>
                  <p className={getIntensityColor(state.currentTest.intensity)}>
                    {state.currentTest.intensity}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Duration</p>
                  <p>{formatDuration(state.currentTest.duration_seconds)}</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progress</span>
                  <span>{progress.toFixed(1)}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            </CardContent>
          </Card>

          {/* Live Metrics */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Live Metrics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="text-center p-3 bg-gray-50 dark:bg-gray-900 rounded">
                  <p className="text-sm text-muted-foreground">Latency</p>
                  <p className="text-xl font-mono">
                    {formatMetricValue('latency_ms', state.metrics.latency_ms)}
                  </p>
                </div>
                <div className="text-center p-3 bg-gray-50 dark:bg-gray-900 rounded">
                  <p className="text-sm text-muted-foreground">Packet Loss</p>
                  <p className="text-xl font-mono">
                    {formatMetricValue('packet_loss_percentage', state.metrics.packet_loss_percentage)}
                  </p>
                </div>
                <div className="text-center p-3 bg-gray-50 dark:bg-gray-900 rounded">
                  <p className="text-sm text-muted-foreground">Jitter</p>
                  <p className="text-xl font-mono">
                    {formatMetricValue('jitter_ms', state.metrics.jitter_ms)}
                  </p>
                </div>
                <div className="text-center p-3 bg-gray-50 dark:bg-gray-900 rounded">
                  <p className="text-sm text-muted-foreground">Sent</p>
                  <p className="text-xl font-mono">{state.metrics.packets_sent}</p>
                </div>
                <div className="text-center p-3 bg-gray-50 dark:bg-gray-900 rounded">
                  <p className="text-sm text-muted-foreground">Received</p>
                  <p className="text-xl font-mono">{state.metrics.packets_received}</p>
                </div>
                <div className="text-center p-3 bg-gray-50 dark:bg-gray-900 rounded">
                  <p className="text-sm text-muted-foreground">Throughput</p>
                  <p className="text-xl font-mono">
                    {formatMetricValue('throughput_mbps', state.metrics.throughput_mbps)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Emergency Stop Reminder */}
      {isTestRunning && (
        <Alert className="border-red-500 bg-red-50 dark:bg-red-950">
          <Shield className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800 dark:text-red-200">
            <strong>Emergency Stop:</strong> Press <kbd className="px-1.5 py-0.5 bg-red-100 dark:bg-red-900 rounded text-xs font-mono">ESC</kbd> or
            click the emergency stop button to immediately halt testing.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}