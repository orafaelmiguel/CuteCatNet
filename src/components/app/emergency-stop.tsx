import { useEffect, useState } from 'react';
import { StopCircle, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { TestStatus } from '@/types/stresser';
import { useStresser } from '@/providers/stresser-provider';

interface EmergencyStopProps {
  onEmergencyStop: () => void;
  isVisible?: boolean;
}

export function EmergencyStop({ onEmergencyStop, isVisible = true }: EmergencyStopProps) {
  const { state } = useStresser();
  const [pulseAnimation, setPulseAnimation] = useState(false);

  // Pulse animation for urgent attention
  useEffect(() => {
    if (state.status === TestStatus.Running) {
      const interval = setInterval(() => {
        setPulseAnimation(prev => !prev);
      }, 1000);

      return () => clearInterval(interval);
    } else {
      setPulseAnimation(false);
    }
  }, [state.status]);

  // Global ESC key handler
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && state.status === TestStatus.Running) {
        event.preventDefault();
        event.stopPropagation();
        onEmergencyStop();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [state.status, onEmergencyStop]);

  // Don't show if not visible or no active test
  if (!isVisible || state.status !== TestStatus.Running) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {/* Emergency Stop Button */}
      <Card className="border-red-500 bg-red-50 dark:bg-red-950 shadow-lg">
        <CardContent className="p-4">
          <Button
            variant="destructive"
            size="lg"
            onClick={onEmergencyStop}
            className={`w-full font-bold text-lg transition-all duration-300 ${
              pulseAnimation ? 'scale-105 shadow-lg' : 'scale-100'
            }`}
          >
            <StopCircle className="h-6 w-6 mr-2" />
            EMERGENCY STOP
          </Button>

          <div className="mt-2 text-center">
            <p className="text-xs text-red-700 dark:text-red-300">
              Press <kbd className="px-1 py-0.5 bg-red-100 dark:bg-red-900 rounded text-xs">ESC</kbd> key
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Safety Reminder */}
      <Alert className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950 max-w-xs">
        <AlertTriangle className="h-4 w-4 text-yellow-600" />
        <AlertDescription className="text-yellow-800 dark:text-yellow-200 text-xs">
          Stop immediately if you notice any network issues or unexpected behavior.
        </AlertDescription>
      </Alert>
    </div>
  );
}

// Floating emergency stop for minimal UI interference
export function FloatingEmergencyStop({ onEmergencyStop }: { onEmergencyStop: () => void }) {
  const { state } = useStresser();

  if (state.status !== TestStatus.Running) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Button
        variant="destructive"
        size="sm"
        onClick={onEmergencyStop}
        className="rounded-full h-12 w-12 shadow-lg hover:scale-110 transition-transform"
        title="Emergency Stop (ESC)"
      >
        <StopCircle className="h-6 w-6" />
      </Button>
    </div>
  );
}