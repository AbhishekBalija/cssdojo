import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { GitHubMark, GoogleMark, Hang, Mountain } from "@/components/Craft";
import { Logo } from "@/components/Logo";
import { api, ApiError, guestId } from "@/lib/api";
import { useMe } from "@/lib/me";
import { safeNext } from "@/lib/next";

type Provider = "github" | "google";

async function social(provider: Provider, next: string): Promise<void> {
  const callbackURL = `${window.location.origin}${next}`;
  const r = await api<{ url?: string }>("/auth/sign-in/social", { method: "POST", json: { provider, callbackURL, errorCallbackURL: `${window.location.origin}/signin?error=1&next=${encodeURIComponent(next)}` } });
  if (r.url) window.location.assign(r.url);
}

export function SignIn() {
  const me = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState("Test Player");
  const [error, setError] = useState<string | null>(null);
  const providers = me.data?.providers ?? { github: false, google: false };
  const params = new URLSearchParams(window.location.search);
  const failed = params.has("error");
  const next = safeNext(params.get("next") ?? undefined);

  const testLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api("/test-login", { method: "POST", json: { name } });
      await qc.invalidateQueries({ queryKey: ["me"] });
      await navigate({ href: next });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Sign-in failed");
    }
  };

  const go = (p: Provider) => {
    setError(null);
    social(p, next).catch(() => setError("Could not reach the sign-in provider. Try again."));
  };

  const solves = me.data ? Object.values(me.data.solvedPerBelt).reduce((n, x) => n + x, 0) : 0;
  const streak = me.data?.streak ?? 0;
  const carry = !me.data?.user && !!guestId() && (solves > 0 || streak > 0);

  return (
    <div className="d-gate">
      <Mountain />
      <div className="d-gatebox">
        <Hang>
          <section className="d-card d-signin">
            <Logo />
            <h1 className="d-art">Step onto the mat</h1>
            <p className="sub">Sign in to rank on the wall, earn belts and keep your kata streak.</p>
            {failed ? (
              <p className="d-warn" role="alert">
                Sign-in did not finish. Please try again.
              </p>
            ) : null}
            {me.data?.user ? (
              <p className="sub">
                You are signed in as <b>{me.data.user.handle ?? me.data.user.name}</b>.{" "}
                <Link to="/" className="d-lnk">
                  Go to home
                </Link>
              </p>
            ) : (
              <>
                {providers.github ? (
                  <button className="d-btn pri wide light" type="button" onClick={() => go("github")} data-testid="signin-github">
                    {GitHubMark} Continue with GitHub
                  </button>
                ) : null}
                {providers.google ? (
                  <button className="d-btn sec wide" type="button" onClick={() => go("google")} data-testid="signin-google">
                    {GoogleMark} Continue with Google
                  </button>
                ) : null}
                {!providers.github && !providers.google && !me.data?.testLogin && !me.isLoading ? <p className="sub">No sign-in providers are configured on this server.</p> : null}
                {me.data?.testLogin ? (
                  <form onSubmit={(e) => void testLogin(e)} className="d-testlogin" data-testid="test-login">
                    <label htmlFor="test-name">Test login (development only)</label>
                    <span className="d-input">
                      <input id="test-name" value={name} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={30} />
                      <button className="d-btn sec" type="submit">
                        Sign in
                      </button>
                    </span>
                  </form>
                ) : null}
                {carry ? (
                  <p className="d-carry">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
                    </svg>
                    <span>
                      Played as a guest:{" "}
                      {solves > 0 ? (
                        <b>
                          {solves} solve{solves === 1 ? "" : "s"}
                        </b>
                      ) : null}
                      {solves > 0 && streak > 0 ? " and a " : streak > 0 ? "a " : ""}
                      {streak > 0 ? <b>{streak} day streak</b> : null} will move to your account when you sign in.
                    </span>
                  </p>
                ) : null}
                {error ? (
                  <p className="d-warn" role="alert">
                    {error}
                  </p>
                ) : null}
                <Link to="/" className="d-lnk" style={{ alignSelf: "center" }}>
                  Keep playing as a guest
                </Link>
              </>
            )}
          </section>
        </Hang>
        <p className="d-gatefoot">
          We keep your name, email and avatar from the provider. <Link to="/privacy">Privacy</Link> · <Link to="/terms">Terms</Link>
        </p>
      </div>
    </div>
  );
}
