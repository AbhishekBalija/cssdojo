import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

/** Shown when nothing is there yet: a short line on what to do next. */
export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty-state" data-testid="empty-state">
      <span className="mark big" aria-hidden="true" />
      <h2>{title}</h2>
      {children ? <p>{children}</p> : null}
      {action}
    </div>
  );
}

/** Shown when a page fails to load: what happened and a way out. */
export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="empty-state" role="alert" data-testid="error-state">
      <span className="lbl">Error</span>
      <h2>Something slipped on the mat</h2>
      <p>{message ?? "This page did not load. Your code and scores are safe."}</p>
      <div className="row-gap">
        {onRetry ? (
          <button className="btn primary" type="button" onClick={onRetry}>
            Try again
          </button>
        ) : null}
        <Link to="/" className="btn">
          Back to the challenges
        </Link>
      </div>
    </div>
  );
}
