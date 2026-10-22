"use client";
import { useEffect, useRef, useId, type ReactNode } from "react";
export default function SidePanel({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const el = ref.current;
    el?.showModal();
    if (contentRef.current) contentRef.current.scrollTop = 0;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      el?.close();
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="workspace-drawer"
      aria-labelledby={titleId}
      onCancel={onClose}
    >
      <header>
        <strong id={titleId}>{title}</strong>
        <button onClick={onClose} aria-label="Close side panel">
          Close ×
        </button>
      </header>
      <div ref={contentRef} className="drawer-content">
        {children}
      </div>
    </dialog>
  );
}
