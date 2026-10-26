import { Link, useRouterState } from "@tanstack/react-router";
import { Moon, Sun } from "lucide-react";
import { useState, type ReactNode } from "react";
import { applyTheme, currentTheme } from "@/lib/theme";
import { useGuestMerge, useMe } from "@/lib/me";
import { Logo } from "./Logo";

export function Header({ children }: { children?: ReactNode }) {
  const [theme, setTheme] = useState(currentTheme());
  const me = useMe();
  useGuestMerge();
  const user = me.data?.user ?? null;
  const here = useRouterState({ select: (st) => st.location.href });
  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    applyTheme(next);
    setTheme(next);
  };
  return (
    <header className="topbar">
      <Logo />
      <nav aria-label="Main">
        <Link to="/kata" activeProps={{ className: "active" }}>
          Daily kata
        </Link>
        <Link to="/" activeProps={{ className: "active" }} activeOptions={{ exact: true }}>
          Challenges
        </Link>
        <Link to="/leaderboard" activeProps={{ className: "active" }}>
          Leaderboard
        </Link>
      </nav>
      {children}
      <div className="h-right">
        <button className="icon-btn" type="button" onClick={toggle} aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}>
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        {user ? (
          <Link to="/me" className="pick" aria-label="Your profile">
            {user.image ? <img src={user.image} alt="" width={22} height={22} style={{ borderRadius: 999 }} /> : null}
            {user.handle ?? user.name}
          </Link>
        ) : (
          <Link to="/signin" search={here === "/" || here.startsWith("/signin") ? {} : { next: here }} className="btn signin">
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
