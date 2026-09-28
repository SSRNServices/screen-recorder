/**
 * High-precision elapsed time tracker that accounts for pauses and tab/popup lifecycle.
 */
export class RecordingTimer {
  private startTime: number | null = null;
  private pausedTime: number | null = null;
  private totalPausedDuration = 0;
  private isPaused = false;
  private isRunning = false;

  public start(initialStartTime: number = Date.now()): void {
    this.startTime = initialStartTime;
    this.pausedTime = null;
    this.totalPausedDuration = 0;
    this.isPaused = false;
    this.isRunning = true;
  }

  public pause(atTime: number = Date.now()): void {
    if (!this.isRunning || this.isPaused) return;
    this.pausedTime = atTime;
    this.isPaused = true;
  }

  public resume(atTime: number = Date.now()): void {
    if (!this.isRunning || !this.isPaused || this.pausedTime === null) return;
    this.totalPausedDuration += atTime - this.pausedTime;
    this.pausedTime = null;
    this.isPaused = false;
  }

  public stop(): number {
    const finalElapsed = this.getElapsedMs();
    this.isRunning = false;
    this.isPaused = false;
    return finalElapsed;
  }

  public reset(): void {
    this.startTime = null;
    this.pausedTime = null;
    this.totalPausedDuration = 0;
    this.isPaused = false;
    this.isRunning = false;
  }

  public getElapsedMs(now: number = Date.now()): number {
    if (!this.isRunning || this.startTime === null) {
      return 0;
    }
    if (this.isPaused && this.pausedTime !== null) {
      return Math.max(0, this.pausedTime - this.startTime - this.totalPausedDuration);
    }
    return Math.max(0, now - this.startTime - this.totalPausedDuration);
  }

  public getState() {
    return {
      startTime: this.startTime,
      pausedTime: this.pausedTime,
      totalPausedDuration: this.totalPausedDuration,
      isPaused: this.isPaused,
      isRunning: this.isRunning,
      elapsedMs: this.getElapsedMs()
    };
  }

  public restore(state: {
    startTime: number | null;
    pausedTime: number | null;
    totalPausedDuration: number;
    isPaused: boolean;
    isRunning: boolean;
  }): void {
    this.startTime = state.startTime;
    this.pausedTime = state.pausedTime;
    this.totalPausedDuration = state.totalPausedDuration;
    this.isPaused = state.isPaused;
    this.isRunning = state.isRunning;
  }
}
