"use client";

import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "./Toast";
import { DEFAULT_DURATION_MS, useToast } from "./useToast";

/** Mount once, near the root of the app (root layout). Toasts are triggered from anywhere via `toast()` — see useToast.ts. */
export function Toaster() {
  const { toasts, dismiss } = useToast();

  return (
    <ToastProvider swipeDirection="right">
      {toasts.map(({ id, title, description, variant, durationMs }) => (
        <Toast
          key={id}
          variant={variant}
          duration={durationMs ?? DEFAULT_DURATION_MS}
          onOpenChange={(open) => {
            if (!open) dismiss(id);
          }}
        >
          <div className="flex flex-1 flex-col gap-1">
            <ToastTitle>{title}</ToastTitle>
            {description ? <ToastDescription>{description}</ToastDescription> : null}
          </div>
          <ToastClose />
        </Toast>
      ))}
      <ToastViewport />
    </ToastProvider>
  );
}
