'use client';

import { ReactNode, useEffect } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { classNames } from '../utils/classNames';

type SnackbarTone = 'success' | 'danger';

interface SnackbarProps {
  message: string | null;
  tone: SnackbarTone;
  onDismiss: () => void;
  duration?: number;
}

const toneClasses: Record<SnackbarTone, { container: string; icon: ReactNode }> = {
  success: {
    container: 'bg-green-200 text-green-900',
    icon: <CheckCircle2 size={18} aria-hidden="true" />,
  },
  danger: {
    container: 'bg-red-200 text-red-900',
    icon: <XCircle size={18} aria-hidden="true" />,
  },
};

const Snackbar = ({ message, tone, onDismiss, duration = 4000 }: SnackbarProps) => {
  useEffect(() => {
    if (!message) {
      return undefined;
    }

    const timeout = window.setTimeout(onDismiss, duration);
    return () => window.clearTimeout(timeout);
  }, [duration, message, onDismiss]);

  if (!message) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed top-6 right-6 z-50 w-full max-w-xs">
      <article
        className={classNames(
          'pointer-events-auto flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-semibold transition-all',
          toneClasses[tone].container,
        )}
        role={tone === 'danger' ? 'alert' : 'status'}
        aria-live={tone === 'danger' ? 'assertive' : 'polite'}
      >
        <span className="shrink-0">{toneClasses[tone].icon}</span>
        <span className="flex-1">{message}</span>
      </article>
    </div>
  );
};

Snackbar.displayName = 'Snackbar';

export default Snackbar;

