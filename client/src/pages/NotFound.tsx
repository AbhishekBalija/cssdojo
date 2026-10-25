import { Link } from "@tanstack/react-router";
import { Header } from "@/components/Header";

export function NotFound() {
  return (
    <div className="app">
      <Header />
      <div className="empty-state">
        <span className="lbl">404</span>
        <h2>This mat is empty</h2>
        <p>The page you were looking for is not here.</p>
        <Link to="/" className="btn primary">
          Back to the challenges
        </Link>
      </div>
    </div>
  );
}
