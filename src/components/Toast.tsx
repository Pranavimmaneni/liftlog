import type { ReactNode } from 'react';
import { create } from 'zustand';

interface ToastState {
  message: string | null;
  show: (m: string, ms?: number) => void;
  clear: () => void;
}

let timer: ReturnType<typeof setTimeout> | undefined;

export const useToast = create<ToastState>((set) => ({
  message: null,
  show(m, ms = 2600) {
    clearTimeout(timer);
    set({ message: m });
    timer = setTimeout(() => set({ message: null }), ms);
  },
  clear() {
    set({ message: null });
  },
}));

export function toast(m: string, ms?: number) {
  useToast.getState().show(m, ms);
}

/** A polite live region for short confirmations. */
export function Toaster() {
  const message = useToast((s) => s.message);
  return (
    <div
      aria-live="polite"
      role="status"
      className="pointer-events-none fixed inset-x-0 top-[calc(12px+env(safe-area-inset-top))] z-[70] flex justify-center px-4"
    >
      {message && (
        <div className="ll-card ll-card-hard pointer-events-auto px-4 py-2.5 text-[15px] font-semibold">
          {message}
        </div>
      )}
    </div>
  );
}

/** S26: every list has an empty state: one line of copy plus the next action. */
export function EmptyState({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="ll-empty ll-card flex flex-col items-start gap-3 border-dashed px-4 py-4">
      <p className="text-[15px] text-ink2">{children}</p>
      {action}
    </div>
  );
}
