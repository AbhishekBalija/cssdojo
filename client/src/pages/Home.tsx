import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { BELTS, SOLVED_AT, type ChallengeSummary } from "@cssdojo/shared";
import { Belt } from "@/components/Belt";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { api, staticUrl } from "@/lib/api";
import { pad3 } from "@/lib/belts";

export function ChallengeCard({ c }: { c: ChallengeSummary }) {
  return (
    <Link to="/c/$id" params={{ id: c.id }} className="card" data-testid="challenge-card">
      <img className="thumb" src={staticUrl(`/targets/${c.id}/thumb.png`)} alt={`Target: ${c.title}`} loading="lazy" width={400} height={300} style={{ background: c.background }} />
      <span className="meta-row">
        <span className="nm">{c.title}</span>
        <span className={`sc${c.best !== null && c.best >= SOLVED_AT ? " solved" : ""}`}>{c.best ?? ""}</span>
      </span>
      <span className="no">
        {pad3(c.number)} · {c.belt} belt
      </span>
    </Link>
  );
}

export function Home() {
  const q = useQuery({ queryKey: ["challenges"], queryFn: () => api<ChallengeSummary[]>("/challenges") });
  const challenges = (q.data ?? []).filter((c) => c.kind === "challenge");
  return (
    <div className="app">
      <Header />
      <main className="page">
        <h1>Rebuild small, real UI</h1>
        <p className="lead">Pick a component, write the HTML and CSS, and get scored on how close it looks and how well it behaves. Belts run from white to black. Solve five of a belt (90 or more) to earn it.</p>
        {q.isLoading ? <p className="note">Loading challenges…</p> : null}
        {BELTS.map((belt) => {
          const items = challenges.filter((c) => c.belt === belt);
          if (items.length === 0) return null;
          return (
            <section key={belt}>
              <div className="sec-title">
                <h2>{belt[0]?.toUpperCase() + belt.slice(1)}</h2>
                <Belt belt={belt} label={`${items.length} challenges`} />
              </div>
              <div className="grid-cards">
                {items.map((c) => (
                  <ChallengeCard key={c.id} c={c} />
                ))}
              </div>
            </section>
          );
        })}
      </main>
      <Footer />
    </div>
  );
}
