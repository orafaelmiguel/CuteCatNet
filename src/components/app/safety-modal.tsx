import { useState, useCallback, useEffect } from 'react';
import { AlertTriangle, Shield, Lock, Eye, StopCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { SafetyConfirmation } from '@/types/stresser';

interface SafetyModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function SafetyModal({ isOpen, onConfirm, onCancel }: SafetyModalProps) {
  const [confirmations, setConfirmations] = useState<SafetyConfirmation>({
    acknowledgeResponsibleUse: false,
    acknowledgePrivateNetworkOnly: false,
    acknowledgeNoMaliciousIntent: false,
    acknowledgeUserResponsibility: false,
    acknowledgeEmergencyStop: false,
  });

  // Reset confirmations when modal closes
  useEffect(() => {
    if (!isOpen) {
      setConfirmations({
        acknowledgeResponsibleUse: false,
        acknowledgePrivateNetworkOnly: false,
        acknowledgeNoMaliciousIntent: false,
        acknowledgeUserResponsibility: false,
        acknowledgeEmergencyStop: false,
      });
    }
  }, [isOpen]);

  const handleResponsibleUseChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setConfirmations(prev => ({ ...prev, acknowledgeResponsibleUse: e.target.checked }));
  }, []);

  const handlePrivateNetworkChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setConfirmations(prev => ({ ...prev, acknowledgePrivateNetworkOnly: e.target.checked }));
  }, []);

  const handleNoMaliciousChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setConfirmations(prev => ({ ...prev, acknowledgeNoMaliciousIntent: e.target.checked }));
  }, []);

  const handleUserResponsibilityChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setConfirmations(prev => ({ ...prev, acknowledgeUserResponsibility: e.target.checked }));
  }, []);

  const handleEmergencyStopChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setConfirmations(prev => ({ ...prev, acknowledgeEmergencyStop: e.target.checked }));
  }, []);

  const allConfirmed = Object.values(confirmations).every(Boolean);

  const handleConfirm = useCallback(() => {
    if (allConfirmed) {
      onConfirm();
    }
  }, [allConfirmed, onConfirm]);

  const handleCancel = useCallback(() => {
    onCancel();
  }, [onCancel]);

  const handleOpenChange = useCallback((open: boolean) => {
    if (!open) {
      onCancel();
    }
  }, [onCancel]);

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Shield className="h-6 w-6 text-yellow-500" />
            Network Stress Testing - Safety Confirmation
          </DialogTitle>
          <DialogDescription className="text-base">
            Before proceeding with network stress testing, you must acknowledge and agree to the following safety requirements and legal obligations.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Warning Alert */}
          <Alert className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-800 dark:text-yellow-200">
              <strong>Important:</strong> Network stress testing can impact network performance and device stability.
              Use only on networks you own or have explicit permission to test.
            </AlertDescription>
          </Alert>

          {/* Legal Notice */}
          <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg border">
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Legal Notice
            </h3>
            <p className="text-sm text-muted-foreground">
              This tool is designed for legitimate network testing and diagnostic purposes only.
              Unauthorized network scanning or stress testing may violate local laws, regulations,
              or terms of service. You are solely responsible for ensuring your use complies with
              all applicable laws and regulations.
            </p>
          </div>

          {/* Technical Limitations */}
          <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Technical Limitations
            </h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Tests are limited to private network ranges (10.x.x.x, 192.168.x.x, 172.16-31.x.x)</li>
              <li>• Maximum test duration: 5 minutes</li>
              <li>• Maximum rate: 1000 packets per second</li>
              <li>• Automatic safety circuits will stop tests if critical issues are detected</li>
              <li>• Dead man's switch requires periodic confirmation</li>
            </ul>
          </div>

          <Separator />

          {/* Safety Confirmations */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Required Confirmations</h3>

            <div className="space-y-3">
              <div className="flex items-start space-x-2">
                <input
                  type="checkbox"
                  id="responsible-use"
                  checked={confirmations.acknowledgeResponsibleUse}
                  onChange={handleResponsibleUseChange}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="responsible-use" className="text-sm leading-5">
                  I confirm that I will use this tool responsibly and only for legitimate network testing,
                  troubleshooting, and diagnostic purposes.
                </label>
              </div>

              <div className="flex items-start space-x-2">
                <input
                  type="checkbox"
                  id="private-network"
                  checked={confirmations.acknowledgePrivateNetworkOnly}
                  onChange={handlePrivateNetworkChange}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="private-network" className="text-sm leading-5">
                  I understand that this tool is restricted to private network ranges only and will not
                  attempt to test external or public networks.
                </label>
              </div>

              <div className="flex items-start space-x-2">
                <input
                  type="checkbox"
                  id="no-malicious"
                  checked={confirmations.acknowledgeNoMaliciousIntent}
                  onChange={handleNoMaliciousChange}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="no-malicious" className="text-sm leading-5">
                  I declare that I have no malicious intent and will not use this tool for any
                  unauthorized or harmful activities.
                </label>
              </div>

              <div className="flex items-start space-x-2">
                <input
                  type="checkbox"
                  id="user-responsibility"
                  checked={confirmations.acknowledgeUserResponsibility}
                  onChange={handleUserResponsibilityChange}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="user-responsibility" className="text-sm leading-5">
                  I understand that I am solely responsible for any consequences of using this tool
                  and agree to comply with all applicable laws and regulations.
                </label>
              </div>

              <div className="flex items-start space-x-2">
                <input
                  type="checkbox"
                  id="emergency-stop"
                  checked={confirmations.acknowledgeEmergencyStop}
                  onChange={handleEmergencyStopChange}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="emergency-stop" className="text-sm leading-5">
                  I understand that the emergency stop button (ESC key) will immediately halt all
                  testing and that I should use it if any issues arise.
                </label>
              </div>
            </div>
          </div>

          {/* Emergency Stop Info */}
          <div className="bg-red-50 dark:bg-red-950 p-4 rounded-lg border border-red-200 dark:border-red-800">
            <h3 className="font-semibold mb-2 flex items-center gap-2 text-red-800 dark:text-red-200">
              <StopCircle className="h-4 w-4" />
              Emergency Stop
            </h3>
            <p className="text-sm text-red-700 dark:text-red-300">
              Press the <kbd className="px-1.5 py-0.5 bg-red-100 dark:bg-red-900 rounded text-xs font-mono">ESC</kbd> key
              at any time to immediately stop all stress testing operations. The emergency stop button
              will also be prominently displayed during testing.
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col space-y-2 sm:flex-row sm:space-y-0">
          <Button variant="outline" onClick={handleCancel} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!allConfirmed}
            className="w-full sm:w-auto"
          >
            {allConfirmed ? 'I Agree - Proceed with Caution' : 'Please Complete All Confirmations'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}