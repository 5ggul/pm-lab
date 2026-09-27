'use client';
import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";
export default function PendingButton({ children, className = "secondary-button", label = "처리 중…" }: { children: ReactNode; className?: string; label?: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" className={className} disabled={pending} aria-busy={pending}>{pending ? label : children}</button>;
}
