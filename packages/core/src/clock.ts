export interface Clock {
  now(): number;
}
export const monotonicClock: Clock = Object.freeze({ now: () => performance.now() });
export const wallClock: Clock = Object.freeze({ now: () => Date.now() });
