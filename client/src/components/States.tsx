import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

// Empty and error states share one card: an icon tile, a small label, a title,
// one line on what to do next and at most one action.

const Icons = {
  empty: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 8h16M8 8v3a4 4 0 0 0 8 0V8M10 15l-2 5M14 15l2 5" />
    </svg>
  ),
  error: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v5M12 16h.01" />
    </svg>
  ),
  lost: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
      <rect x="5" y="5" width="14" height="14" rx="3" />
      <path d="M10 10l4 4M14 10l-4 4" />
    </svg>
  ),
};

function StateCard({ kind, icon, title, children, action, testId }: { kind: "empty" | "error"; icon: ReactNode; title: string; children?: ReactNode; action?: ReactNode; testId: string }) {
  return (
    <div className={`d-state ${kind}`} role={kind === "error" ? "alert" : undefined} data-testid={testId}>
      <span className="ic">{icon}</span>
      <span className="lb">{kind === "error" ? "Error" : "Empty"}</span>
      <h2>{title}</h2>
      {children ? <p>{children}</p> : null}
      {action}
    </div>
  );
}

/** Shown when nothing is there yet: a short line on what to do next. */
export function EmptyState({ title, children, action, icon }: { title: string; children?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <StateCard kind="empty" icon={icon ?? Icons.empty} title={title} action={action} testId="empty-state">
      {children}
    </StateCard>
  );
}

/** Shown when a page fails to load: what happened and a way out. */
export function ErrorState({ title, message, onRetry }: { title?: string; message?: string; onRetry?: () => void }) {
  return (
    <StateCard
      kind="error"
      icon={Icons.error}
      title={title ?? "Something slipped on the mat"}
      testId="error-state"
      action={
        onRetry ? (
          <button className="d-btn sec" type="button" onClick={onRetry}>
            Try again
          </button>
        ) : (
          <Link to="/" className="d-btn sec">
            Go home
          </Link>
        )
      }
    >
      {message ?? "This page did not load. Your code and scores are safe."}
    </StateCard>
  );
}

/** The 404 card. */
export function LostState() {
  return (
    <StateCard
      kind="error"
      icon={Icons.lost}
      title="This page is off the mat"
      testId="not-found"
      action={
        <Link to="/" className="d-btn sec">
          Go home
        </Link>
      }
    >
      The link is old or mistyped.
    </StateCard>
  );
}

/** A full page around a state card, for routes outside the shell. */
export function StatePage({ children }: { children: ReactNode }) {
  return (
    <div className="d-gate">
      <div className="d-gatebox">{children}</div>
    </div>
  );
}
