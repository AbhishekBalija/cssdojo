import { Link } from "@tanstack/react-router";

/** The mat-and-belt mark plus the "cssdojo" wordmark ("css" muted). */
export function Logo() {
  return (
    <Link to="/" className="word" aria-label="CSS Dojo home">
      <i className="mark" aria-hidden="true" />
      <span>
        <span className="css">css</span>dojo
      </span>
    </Link>
  );
}
