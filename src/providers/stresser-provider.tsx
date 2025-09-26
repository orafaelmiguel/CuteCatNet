import React, { createContext, useContext, useEffect, useReducer, useCallback, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import {
  TestStatus,
  TestMetrics,
  TestResult,
  StressTestConfig,
  StressTestUpdateEvent,
  StressTestFormData,
} from '@/types/stresser';
import { stressTestApi, StressTestError } from '@/api/stresser';

// Context state interface
interface StresserState {
  currentTest: TestResult | null;
  status: TestStatus;
  metrics: TestMetrics;
  history: TestResult[];
  isLoading: boolean;
  error: string | null;
  emergencyStopEnabled: boolean;
  safetyConfirmed: boolean;
}

// Action types
type StresserAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_CURRENT_TEST'; payload: TestResult | null }
  | { type: 'SET_STATUS'; payload: TestStatus }
  | { type: 'SET_METRICS'; payload: TestMetrics }
  | { type: 'ADD_TO_HISTORY'; payload: TestResult }
  | { type: 'UPDATE_TEST'; payload: Partial<TestResult> }
  | { type: 'SET_EMERGENCY_STOP'; payload: boolean }
  | { type: 'SET_SAFETY_CONFIRMED'; payload: boolean }
  | { type: 'RESET_STATE' };

// Context interface
interface StresserContextType {
  state: StresserState;
  actions: {
    startTest: (config: StressTestFormData) => Promise<void>;
    stopTest: () => Promise<void>;
    emergencyStop: () => Promise<void>;
    confirmSafety: () => void;
    clearError: () => void;
    refreshStatus: () => Promise<void>;
  };
}

// Initial state
const initialState: StresserState = {
  currentTest: null,
  status: TestStatus.Idle,
  metrics: {
    latency_ms: 0,
    packet_loss_percentage: 0,
    throughput_mbps: 0,
    jitter_ms: 0,
    packets_sent: 0,
    packets_received: 0,
    timestamp: 0,
  },
  history: [],
  isLoading: false,
  error: null,
  emergencyStopEnabled: true,
  safetyConfirmed: false,
};

// Reducer
function stresserReducer(state: StresserState, action: StresserAction): StresserState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };

    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false };

    case 'SET_CURRENT_TEST':
      return { ...state, currentTest: action.payload };

    case 'SET_STATUS':
      return { ...state, status: action.payload };

    case 'SET_METRICS':
      return { ...state, metrics: action.payload };

    case 'ADD_TO_HISTORY':
      return {
        ...state,
        history: [action.payload, ...state.history.slice(0, 99)], // Keep last 100 tests
      };

    case 'UPDATE_TEST':
      if (!state.currentTest) return state;

      const updatedTest = { ...state.currentTest, ...action.payload };
      return {
        ...state,
        currentTest: updatedTest,
        // If test is completed or failed, add to history
        ...(updatedTest.status === TestStatus.Completed || updatedTest.status === TestStatus.Failed
          ? { history: [updatedTest, ...state.history.slice(0, 99)] }
          : {}),
      };

    case 'SET_EMERGENCY_STOP':
      return { ...state, emergencyStopEnabled: action.payload };

    case 'SET_SAFETY_CONFIRMED':
      return { ...state, safetyConfirmed: action.payload };

    case 'RESET_STATE':
      return {
        ...initialState,
        history: state.history, // Preserve history
        safetyConfirmed: state.safetyConfirmed, // Preserve safety confirmation
      };

    default:
      return state;
  }
}

// Context
const StresserContext = createContext<StresserContextType | undefined>(undefined);

// Provider props
interface StresserProviderProps {
  children: React.ReactNode;
}

// Provider component
export function StresserProvider({ children }: StresserProviderProps) {
  const [state, dispatch] = useReducer(stresserReducer, initialState);
  const eventListenerRef = useRef<(() => void) | null>(null);

  // Load persisted data on mount
  useEffect(() => {
    const loadPersistedData = () => {
      try {
        // Load history from localStorage
        const savedHistory = localStorage.getItem('stresser-history');
        if (savedHistory) {
          const history = JSON.parse(savedHistory) as TestResult[];
          history.forEach(test => {
            dispatch({ type: 'ADD_TO_HISTORY', payload: test });
          });
        }

        // Load safety confirmation
        const safetyConfirmed = localStorage.getItem('stresser-safety-confirmed') === 'true';
        dispatch({ type: 'SET_SAFETY_CONFIRMED', payload: safetyConfirmed });
      } catch (error) {
        console.error('Failed to load persisted data:', error);
      }
    };

    loadPersistedData();
  }, []);

  // Save history to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('stresser-history', JSON.stringify(state.history));
    } catch (error) {
      console.error('Failed to save history:', error);
    }
  }, [state.history]);

  // Save safety confirmation
  useEffect(() => {
    try {
      localStorage.setItem('stresser-safety-confirmed', state.safetyConfirmed.toString());
    } catch (error) {
      console.error('Failed to save safety confirmation:', error);
    }
  }, [state.safetyConfirmed]);

  // Set up real-time event listeners
  useEffect(() => {
    const setupEventListeners = async () => {
      try {
        // Listen for stress test updates
        const unlisten = await listen<StressTestUpdateEvent>('stress_test_update', (event) => {
          const { metrics, status } = event.payload;
          dispatch({ type: 'SET_METRICS', payload: metrics });
          dispatch({ type: 'SET_STATUS', payload: status });

          // Update current test if it exists
          if (state.currentTest) {
            dispatch({
              type: 'UPDATE_TEST',
              payload: { status, final_metrics: metrics },
            });
          }
        });

        eventListenerRef.current = unlisten;
      } catch (error) {
        console.error('Failed to set up event listeners:', error);
      }
    };

    setupEventListeners();

    // Cleanup
    return () => {
      if (eventListenerRef.current) {
        eventListenerRef.current();
      }
    };
  }, [state.currentTest]);

  // Refresh current status
  const refreshStatus = useCallback(async () => {
    try {
      const { status, metrics, currentTest } = await stressTestApi.getTestInfo();
      dispatch({ type: 'SET_STATUS', payload: status });
      dispatch({ type: 'SET_METRICS', payload: metrics });
      dispatch({ type: 'SET_CURRENT_TEST', payload: currentTest });
    } catch (error) {
      console.error('Failed to refresh status:', error);
      if (error instanceof StressTestError) {
        dispatch({ type: 'SET_ERROR', payload: error.message });
      }
    }
  }, []);

  // Start test action
  const startTest = useCallback(async (formData: StressTestFormData) => {
    if (!state.safetyConfirmed) {
      dispatch({ type: 'SET_ERROR', payload: 'Safety confirmation required before starting test' });
      return;
    }

    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });

    try {
      // Convert form data to config
      const config: StressTestConfig = {
        target_ip: formData.targetIp,
        test_type: formData.testType,
        intensity: formData.intensity,
        duration_seconds: formData.duration,
      };

      // Validate configuration
      const validation = await stressTestApi.validateConfiguration(config);
      if (!validation.isValid) {
        throw new Error(validation.errors.join(', '));
      }

      // Check if we can start
      const canStart = await stressTestApi.canStartTest();
      if (!canStart.canStart) {
        throw new Error(canStart.reason || 'Cannot start test');
      }

      // Start the test
      const testId = await stressTestApi.startTest(config);

      // Create test result object
      const testResult: TestResult = {
        test_id: testId,
        target_ip: config.target_ip,
        test_type: config.test_type,
        intensity: config.intensity,
        duration_seconds: config.duration_seconds,
        start_time: Date.now(),
        status: TestStatus.Running,
      };

      dispatch({ type: 'SET_CURRENT_TEST', payload: testResult });
      dispatch({ type: 'SET_STATUS', payload: TestStatus.Running });

    } catch (error) {
      console.error('Failed to start test:', error);
      if (error instanceof StressTestError) {
        dispatch({ type: 'SET_ERROR', payload: `${error.errorType}: ${error.message}` });
      } else {
        dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Unknown error' });
      }
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [state.safetyConfirmed]);

  // Stop test action
  const stopTest = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', payload: true });

    try {
      await stressTestApi.stopTest();
      dispatch({ type: 'SET_STATUS', payload: TestStatus.Completed });

      if (state.currentTest) {
        dispatch({
          type: 'UPDATE_TEST',
          payload: {
            status: TestStatus.Completed,
            end_time: Date.now(),
          },
        });
      }
    } catch (error) {
      console.error('Failed to stop test:', error);
      if (error instanceof StressTestError) {
        dispatch({ type: 'SET_ERROR', payload: error.message });
      }
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [state.currentTest]);

  // Emergency stop action
  const emergencyStop = useCallback(async () => {
    dispatch({ type: 'SET_EMERGENCY_STOP', payload: false });

    try {
      await stressTestApi.emergencyStop();
      dispatch({ type: 'RESET_STATE' });
      dispatch({ type: 'SET_STATUS', payload: TestStatus.Idle });
    } catch (error) {
      console.error('Emergency stop failed:', error);
    } finally {
      dispatch({ type: 'SET_EMERGENCY_STOP', payload: true });
    }
  }, []);

  // Confirm safety action
  const confirmSafety = useCallback(() => {
    dispatch({ type: 'SET_SAFETY_CONFIRMED', payload: true });
  }, []);

  // Clear error action
  const clearError = useCallback(() => {
    dispatch({ type: 'SET_ERROR', payload: null });
  }, []);

  // Actions object
  const actions = {
    startTest,
    stopTest,
    emergencyStop,
    confirmSafety,
    clearError,
    refreshStatus,
  };

  // Context value
  const contextValue: StresserContextType = {
    state,
    actions,
  };

  return (
    <StresserContext.Provider value={contextValue}>
      {children}
    </StresserContext.Provider>
  );
}

// Hook to use the context
export function useStresser(): StresserContextType {
  const context = useContext(StresserContext);
  if (context === undefined) {
    throw new Error('useStresser must be used within a StresserProvider');
  }
  return context;
}