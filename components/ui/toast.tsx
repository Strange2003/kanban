"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type ToastVariant = "default" | "destructive";
type Toast = { id: number; message: string; variant: ToastVariant };

const ToastContext = React.createContext<{ toast: (message: string, variant?: ToastVariant) => void } | null>(
  null,
);

let idCounter = 0;

/**
 * Minimal hand-built toast system (matches components/ui/dialog.tsx's
 * approach — no Radix/library dependency) for surfacing Server Action
 * errors that don't already have a dedicated place to show inline, e.g. an
 * optimistic drag-and-drop reorder that failed and reverted.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const toast = React.useCallback((message: string, variant: ToastVariant = "default") => {
    const id = ++idCounter;
    setToasts((current) => [...current, { id, message, variant }]);
    setTimeout(() => {
      setToasts((current) => current.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={cn(
              "rounded-md border border-border bg-popover px-4 py-2 text-sm shadow-lg",
              t.variant === "destructive" && "border-destructive text-destructive",
            )}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
