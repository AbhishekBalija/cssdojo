import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

/** Modal dialog in the approved style: scrim, Escape and backdrop click close it, focus moves in. */
export function Dialog({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="scrim" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label={title}>
        <div className="dh">
          <h2>{title}</h2>
          <button ref={closeRef} className="x" type="button" aria-label="Close" onClick={onClose}>
            <X size={14} strokeWidth={2.4} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
