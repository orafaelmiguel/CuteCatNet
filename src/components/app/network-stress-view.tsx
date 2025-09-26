import { useState } from 'react';
import { Shield, History } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StresserProvider, useStresser } from '@/providers/stresser-provider';
import { SafetyModal } from './safety-modal';
import { StressTestInterface } from './stress-test-interface';
import { EmergencyStop, FloatingEmergencyStop } from './emergency-stop';
import { TestStatus } from '@/types/stresser';

function NetworkStressContent() {
  const { state, actions } = useStresser();
  const [showSafetyModal, setShowSafetyModal] = useState(false);

  const handleSafetyConfirm = () => {
    actions.confirmSafety();
    setShowSafetyModal(false);
  };

  const handleEmergencyStop = () => {
    actions.emergencyStop();
  };

  const openSafetyModal = () => {
    setShowSafetyModal(true);
  };

  const isTestActive = state.status === TestStatus.Running;

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                <CardTitle>Network Stress Tester</CardTitle>
              </div>
              <div className="flex items-center gap-2">
                {!state.safetyConfirmed && (
                  <Button onClick={openSafetyModal} variant="outline" size="sm">
                    <Shield className="h-4 w-4 mr-2" />
                    Safety Confirmation Required
                  </Button>
                )}
                {state.safetyConfirmed && (
                  <span className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
                    <Shield className="h-4 w-4" />
                    Safety Confirmed
                  </span>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Responsible network performance and reliability testing for your private networks.
              This tool helps diagnose network issues, validate QoS settings, and test infrastructure resilience.
            </p>

            {!state.safetyConfirmed && (
              <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  <strong>Important:</strong> Before using this tool, you must complete the safety confirmation
                  to acknowledge responsible use guidelines and legal requirements.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Error Display */}
        {state.error && (
          <Card className="border-red-500 bg-red-50 dark:bg-red-950">
            <CardContent className="pt-6">
              <div className="flex justify-between items-start">
                <p className="text-red-800 dark:text-red-200">{state.error}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={actions.clearError}
                  className="text-red-800 dark:text-red-200"
                >
                  ×
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Interface */}
        {state.safetyConfirmed ? (
          <StressTestInterface onEmergencyStop={handleEmergencyStop} />
        ) : (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-10">
                <Shield className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-medium">Safety Confirmation Required</h3>
                <p className="mt-2 text-sm text-muted-foreground mb-4">
                  Complete the safety acknowledgment to access network stress testing features.
                </p>
                <Button onClick={openSafetyModal}>
                  <Shield className="h-4 w-4 mr-2" />
                  Review Safety Guidelines
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Test History */}
        {state.safetyConfirmed && state.history.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Recent Tests
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {state.history.slice(0, 5).map((test) => (
                  <div key={test.test_id} className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-900 rounded">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{test.target_ip}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(test.start_time).toLocaleString()} - {test.test_type} ({test.intensity})
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`text-xs font-medium ${
                        test.status === TestStatus.Completed ? 'text-green-600' :
                        test.status === TestStatus.Failed ? 'text-red-600' :
                        'text-gray-600'
                      }`}>
                        {test.status}
                      </p>
                      {test.final_metrics && (
                        <p className="text-xs text-muted-foreground">
                          {test.final_metrics.packet_loss_percentage.toFixed(1)}% loss
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Emergency Stop Components */}
      <EmergencyStop onEmergencyStop={handleEmergencyStop} isVisible={isTestActive} />
      <FloatingEmergencyStop onEmergencyStop={handleEmergencyStop} />

      {/* Safety Modal */}
      <SafetyModal
        isOpen={showSafetyModal}
        onConfirm={handleSafetyConfirm}
        onCancel={() => setShowSafetyModal(false)}
      />
    </>
  );
}

export function NetworkStressView() {
  return (
    <StresserProvider>
      <NetworkStressContent />
    </StresserProvider>
  );
}