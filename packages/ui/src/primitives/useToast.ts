"use client";

import { useEffect, useState } from "react";

export interface ToastOptions {
  title: string;
  // Explicitly `| undefined` (not just `?`) so callers can pass something
  // like `error instanceof Error ? error.message : undefined` directly —
  // common for surfacing caught errors — without exactOptionalPropertyTypes
  // rejecting the literal `undefined` value.
  description?: string | undefined;
  variant?: "default" | "success" | "error";
  durationMs?: number;
}

interface ToastRecord extends ToastOptions {
  id: string;
}

const DEFAULT_DURATION_MS = 5000;

// Module-level store so `toast()` can be called from anywhere (event
// handlers, server-action result handling) without needing a hook in scope,
// while every mounted <Toaster/>'s useToast() subscription stays in sync —
// the same pattern shadcn/ui's use-toast uses.
let toasts: ToastRecord[] = [];
const listeners = new Set<(toasts: ToastRecord[]) => void>();

function emit() {
  for (const listener of listeners) listener(toasts);
}

export function toast(options: ToastOptions): void {
  const id = crypto.randomUUID();
  toasts = [...toasts, { ...options, id }];
  emit();
}

export function dismissToast(id: string): void {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export function useToast(): { toasts: ToastRecord[]; dismiss: (id: string) => void } {
  const [state, setState] = useState<ToastRecord[]>(toasts);

  useEffect(() => {
    listeners.add(setState);
    return () => {
      listeners.delete(setState);
    };
  }, []);

  return { toasts: state, dismiss: dismissToast };
}

export { DEFAULT_DURATION_MS };
