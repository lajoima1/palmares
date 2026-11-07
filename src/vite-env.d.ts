/// <reference types="vite/client" />

// True in the Cloudflare build and in `npm run dev`; false in the GitHub Pages build (vite.config.ts).
declare const __LOOKS__: boolean;

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
