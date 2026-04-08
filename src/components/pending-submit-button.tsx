"use client";

import { useFormStatus } from "react-dom";

type PendingSubmitButtonProps = {
  className: string;
  children: React.ReactNode;
  pendingText?: React.ReactNode;
  disabled?: boolean;
  ariaLabel?: string;
};

export function PendingSubmitButton({
  className,
  children,
  pendingText,
  disabled,
  ariaLabel,
}: PendingSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className={className}
      aria-label={ariaLabel}
      disabled={pending || disabled}
    >
      {pending ? pendingText ?? "Loading..." : children}
    </button>
  );
}