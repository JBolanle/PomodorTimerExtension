// Thin wrapper that re-exports the timer-state context hook. Kept so
// existing consumers (`useTimerState()`) don't need to change their
// imports. The real implementation lives in
// `src/contexts/TimerStateContext.tsx`.

export { useTimerStateContext as useTimerState } from '@/contexts/TimerStateContext';
