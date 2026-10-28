import { Link } from "@tanstack/react-router";

export function Footer() {
  return (
    <footer className="footer">
      <span>CSS Dojo 0.1.0</span>
      <Link to="/gallery">Gallery</Link>
      <Link to="/assets">Brand</Link>
      <Link to="/privacy">Privacy</Link>
      <Link to="/terms">Terms</Link>
      <a href="https://github.com/AbhishekBalija/cssdojo">Source (MIT)</a>
    </footer>
  );
}
