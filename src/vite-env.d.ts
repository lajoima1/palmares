/// <reference types="vite/client" />

// Wake Lock API types
interface WakeLockSentinel {
  readonly released: boolean;
  readonly type: WakeLockType;
  release(): Promise<void>;
}

type WakeLockType = "screen";

interface Navigator {
  wakeLock?: {
    request(type: WakeLockType): Promise<WakeLockSentinel>;
  };
}
