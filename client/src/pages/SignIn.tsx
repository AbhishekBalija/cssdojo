import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { api, ApiError } from "@/lib/api";
import { useMe } from "@/lib/me";

type Provider = "github" | "google";

async function social(provider: Provider): Promise<void> {
  const callbackURL = `${window.location.origin}/me`;
  const r = await api<{ url?: string }>("/auth/sign-in/social", { method: "POST", json: { provider, callbackURL, errorCallbackURL: `${window.location.origin}/signin?error=1` } });
  if (r.url) window.location.assign(r.url);
}

export function SignIn() {
  const me = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState("Test Player");
  const [error, setError] = useState<string | null>(null);
  const providers = me.data?.providers ?? { github: false, google: false };
  const failed = new URLSearchParams(window.location.search).has("error");

  const testLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api("/test-login", { method: "POST", json: { name } });
      await qc.invalidateQueries({ queryKey: ["me"] });
      await navigate({ to: "/me" });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Sign-in failed");
    }
  };

  const go = (p: Provider) => {
    setError(null);
    social(p).catch(() => setError("Could not reach the sign-in provider. Try again."));
  };

  return (
    <div className="app">
      <Header />
      <main className="page narrow">
        <h1>Sign in</h1>
        <p className="lead">Sign in to get on the leaderboards, earn belts and keep a kata streak. Anything you solved as a guest in this browser moves to your account.</p>
        {failed ? <p className="banner warn">Sign-in did not finish. Please try again.</p> : null}
        {me.data?.user ? (
          <p>
            You are signed in as <strong>{me.data.user.handle ?? me.data.user.name}</strong>. <Link to="/me">Go to your profile</Link>.
          </p>
        ) : (
          <div className="signin-box">
            {providers.github ? (
              <button className="btn primary wide" type="button" onClick={() => go("github")} data-testid="signin-github">
                Continue with GitHub
              </button>
            ) : null}
            {providers.google ? (
              <button className="btn wide" type="button" onClick={() => go("google")} data-testid="signin-google">
                Continue with Google
              </button>
            ) : null}
            {!providers.github && !providers.google && !me.data?.testLogin ? <p className="note">No sign-in providers are configured on this server.</p> : null}
            {me.data?.testLogin ? (
              <form onSubmit={(e) => void testLogin(e)} className="test-login" data-testid="test-login">
                <label htmlFor="test-name">Test login (development only)</label>
                <div className="row">
                  <input id="test-name" className="input" value={name} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={30} />
                  <button className="btn" type="submit">
                    Sign in
                  </button>
                </div>
              </form>
            ) : null}
            {error ? <p className="banner warn">{error}</p> : null}
          </div>
        )}
        <p className="note">
          We store your name, email and avatar from the provider. See <Link to="/privacy">privacy</Link>.
        </p>
      </main>
      <Footer />
    </div>
  );
}
