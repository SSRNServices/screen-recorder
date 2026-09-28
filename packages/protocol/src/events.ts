import type { RecordingStatusSnapshot, RecordingState } from './messages.js';

export interface StateChangeEvent {
  previousState: RecordingState;
  newState: RecordingState;
  snapshot: RecordingStatusSnapshot;
}

export type StateChangeListener = (event: StateChangeEvent) => void;
