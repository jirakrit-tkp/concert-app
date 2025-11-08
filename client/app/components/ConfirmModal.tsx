'use client';

import { ReactNode, useCallback, useEffect } from 'react';
import { X, XCircle } from 'lucide-react';
import { classNames } from '../utils/classNames';

type ConfirmModalTone = 'danger' | 'default';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmDisabled?: boolean;
  cancelDisabled?: boolean;
  iconTone?: ConfirmModalTone;
  customIcon?: ReactNode;
}

const toneIconClasses: Record<ConfirmModalTone, string> = {
  danger: 'bg-red-1/10 text-red-2',
  default: 'bg-blue-1/10 text-blue-2',
};

const ConfirmModal = ({
  isOpen,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  confirmDisabled = false,
  cancelDisabled = false,
  iconTone = 'default',
  customIcon,
}: ConfirmModalProps) => {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCancel();
      }
    },
    [onCancel],
  );

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown, isOpen]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      onClick={onCancel}
    >
      <div className="relative w-full max-w-sm rounded-lg bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          aria-label="Close dialog"
          className="absolute right-4 top-4 rounded-full p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
          onClick={onCancel}
          disabled={cancelDisabled}
        >
          <X size={16} aria-hidden="true" />
        </button>
        <div className="flex flex-col items-center text-center">
          <div
            className={classNames('flex h-16 w-16 items-center justify-center rounded-full', toneIconClasses[iconTone])}
          >
            {customIcon ?? <XCircle size={32} aria-hidden="true" />}
          </div>
          <h2 id="confirm-modal-title" className="mt-4 text-lg font-semibold text-zinc-800">
            {title}
          </h2>
          {description ? <p className="mt-2 text-sm text-zinc-500">{description}</p> : null}
        </div>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            className="w-full rounded-lg border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-600 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 sm:w-1/2"
            onClick={onCancel}
            disabled={cancelDisabled}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={classNames(
              'w-full rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-70 sm:w-1/2',
              iconTone === 'danger' ? 'bg-red-2 hover:bg-red-1' : 'bg-blue-1 hover:bg-blue-2',
            )}
            onClick={onConfirm}
            disabled={confirmDisabled}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

ConfirmModal.displayName = 'ConfirmModal';

export default ConfirmModal;

