import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { BELTS, SOLVED_AT, SOLVES_PER_BELT, type Belt as BeltName, type ProfileView } from "@cssdojo/shared";
import { Belt } from "@/components/Belt";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { api } from "@/lib/api";
import { BELT_COLOR, beltLabel, pad3 } from "@/lib/belts";
import { formatDuration } from "@/lib/format";
import { signOut, useMe } from "@/lib/me";

function BeltProgress({ belts, solved }: { belts: BeltName[]; solved: Record<BeltName, number> }) {
  return (
    <div className="belt-track" data-testid="belt-progress">
      {BELTS.map((b) => {
        const earned = belts.includes(b);
        const n = Math.min(solved[b], SOLVES_PER_BELT);
        return (
          <div key={b} className={`belt-step${earned ? " earned" : ""}`}>
            <span className="bar">
              <i style={{ width: `${(n / SOLVES_PER_BELT) * 100}%`, background: BELT_COLOR[b] }} />
            </span>
            <span className="bl">
              {beltLabel(b)} <span className="note">{earned ? "earned" : `${n}/${SOLVES_PER_BELT}`}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ProfileBody({ p, own }: { p: ProfileView; own: boolean }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const top = BELTS.filter((b) => p.belts.includes(b)).at(-1);
  return (
    <>
      <div className="profile-head">
        {p.image ? <img src={p.image} alt="" width={56} height={56} className="avatar" /> : <span className="avatar ph">{p.handle.slice(0, 1).toUpperCase()}</span>}
        <div>
          <h1>{p.handle}</h1>
          <p className="note">
            Joined {new Date(p.joined).toLocaleDateString("en-GB", { month: "short", year: "numeric" })} · kata streak {p.streak} {p.streak === 1 ? "day" : "days"}
          </p>
        </div>
        {top ? <Belt belt={top} /> : null}
        {own ? (
          <button
            className="btn sm"
            type="button"
            onClick={() =>
              void signOut().then(async () => {
                await qc.invalidateQueries();
                await navigate({ to: "/" });
              })
            }
          >
            Sign out
          </button>
        ) : null}
      </div>
      <h2 className="h2">Belts</h2>
      <p className="note">Solve {SOLVES_PER_BELT} challenges of a belt with {SOLVED_AT} or more to earn it. Belts come in order.</p>
      <BeltProgress belts={p.belts} solved={p.solvedPerBelt} />
      <h2 className="h2">Best scores</h2>
      {p.bests.length === 0 ? <p className="note">No scores yet.</p> : null}
      <div className="lb page-lb bests">
        {p.bests.map((b) => (
          <div key={`${b.challengeId}-${b.board}`}>
            <span className="n">{pad3(b.number)}</span>
            <Link to="/c/$id" params={{ id: b.challengeId }}>
              {b.title}
            </Link>
            <span className="t">{b.board === "library" ? beltLabel(b.belt) : `kata ${b.board.slice(5)}`}</span>
            <span className="t">{formatDuration(b.solveMs)}</span>
            <span className={`s${b.score >= SOLVED_AT ? " solved" : ""}`}>{b.score}</span>
          </div>
        ))}
      </div>
    </>
  );
}

export function PublicProfile({ handle }: { handle: string }) {
  const me = useMe();
  const q = useQuery({ queryKey: ["profile", handle], queryFn: () => api<ProfileView>(`/profile/${encodeURIComponent(handle)}`), retry: false });
  return (
    <div className="app">
      <Header />
      <main className="page narrow-lb">
        {q.isError ? (
          <div className="empty-state">
            <h2>No player called {handle}</h2>
            <Link to="/leaderboard">Back to the leaderboard</Link>
          </div>
        ) : null}
        {q.data ? <ProfileBody p={q.data} own={me.data?.user?.handle === handle} /> : null}
      </main>
      <Footer />
    </div>
  );
}

/** Your own page: the profile when signed in, otherwise guest progress and a sign-in prompt. */
export function MyProfile() {
  const me = useMe();
  const handle = me.data?.user?.handle ?? null;
  if (handle) return <PublicProfile handle={handle} />;
  return (
    <div className="app">
      <Header />
      <main className="page narrow-lb">
        <h1>Your progress</h1>
        <p className="lead">You are playing as a guest. Sign in to keep this progress on any device, appear on leaderboards and keep a kata streak.</p>
        <Link to="/signin" search={{ next: "/me" }} className="btn primary">
          Sign in
        </Link>
        {me.data ? (
          <>
            <h2 className="h2">Belts</h2>
            <BeltProgress belts={me.data.belts} solved={me.data.solvedPerBelt} />
          </>
        ) : null}
      </main>
      <Footer />
    </div>
  );
}
