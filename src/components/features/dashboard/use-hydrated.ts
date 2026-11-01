"use client";

import { useSyncExternalStore } from "react";

const noSubscribe = () => () => {};

/**
 * False during the server render and hydration, true afterwards. Charts render only in the browser: Recharts creates
 * element ids that can differ between server and client, and their text equivalents are server-rendered anyway.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  );
}
