import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import type { ChallengeSummary, KataToday, LeaderboardRow, RankingRow } from "@cssdojo/shared";
import { Belt } from "@/components/Belt";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { api } from "@/lib/api";
import { pad3 } from "@/lib/belts";
import { formatDuration } from "@/lib/format";

type Tab = "kata" | "overall" | "challenge";

function Board({ challengeId, board }: { challengeId: string; board: string }) {
  const q = useQuery({ queryKey: ["lb", challengeId, board], queryFn: () => api<LeaderboardRow[]>(`/leaderboard/${challengeId}?board=${encodeURIComponent(board)}`) });
  return (
    <div className="lb page-lb" data-testid="board">
      {(q.data ?? []).map((r) => (
        <div key={`${r.rank}-${r.handle}`} className={r.me ? "me" : ""}>
          <span className="n">{r.rank}</span>
          <Link to="/u/$handle" params={{ handle: r.handle }}>
            {r.me ? `${r.handle} (you)` : r.handle}
          </Link>
          <span className="t">{formatDuration(r.solveMs)}</span>
          <span className="s">{r.score}</span>
        </div>
      ))}
      {q.data && q.data.length === 0 ? <div className="empty-note">No signed-in scores yet. Be the first.</div> : null}
    </div>
  );
}

function Overall() {
  const q = useQuery({ queryKey: ["rankings"], queryFn: () => api<RankingRow[]>("/rankings") });
  return (
    <div className="lb page-lb overall" data-testid="rankings">
      {(q.data ?? []).map((r) => (
        <div key={`${r.rank}-${r.handle}`} className={r.me ? "me" : ""}>
          <span className="n">{r.rank}</span>
          <Link to="/u/$handle" params={{ handle: r.handle }}>
            {r.me ? `${r.handle} (you)` : r.handle}
          </Link>
          <span>{r.topBelt ? <Belt belt={r.topBelt} /> : <span className="note">no belt yet</span>}</span>
          <span className="t">{r.solved} solved</span>
          <span className="s">{r.total}</span>
        </div>
      ))}
      {q.data && q.data.length === 0 ? <div className="empty-note">No signed-in players yet.</div> : null}
    </div>
  );
}

export function Leaderboard() {
  const [tab, setTab] = useState<Tab>("kata");
  const kata = useQuery({ queryKey: ["kata-today"], queryFn: () => api<KataToday>("/kata/today"), staleTime: 60_000 });
  const list = useQuery({ queryKey: ["challenges"], queryFn: () => api<ChallengeSummary[]>("/challenges") });
  const library = (list.data ?? []).filter((c) => c.kind === "challenge");
  const [pick, setPick] = useState<string>("");
  const challengeId = pick || library[0]?.id || "";
  return (
    <div className="app">
      <Header />
      <main className="page narrow-lb">
        <h1>Leaderboard</h1>
        <p className="lead">Signed-in players only. Best score first; ties go to the faster solve, timed from first open to the best Submit.</p>
        <div className="seg tabs" role="tablist" aria-label="Leaderboard">
          {(
            [
              ["kata", "Today's kata"],
              ["overall", "Overall"],
              ["challenge", "By challenge"],
            ] as const
          ).map(([id, label]) => (
            <button key={id} role="tab" type="button" aria-selected={tab === id} className={tab === id ? "on" : ""} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </div>
        {tab === "kata" && kata.data ? (
          <>
            <p className="note">
              Day {kata.data.day} · board closes at 00:00 UTC. <Link to="/kata">Play today's kata</Link>
            </p>
            <Board challengeId={kata.data.challengeId} board={`kata:${kata.data.date}`} />
          </>
        ) : null}
        {tab === "overall" ? (
          <>
            <p className="note">Highest belt first, then challenges solved (90 or more), then the total of best scores.</p>
            <Overall />
          </>
        ) : null}
        {tab === "challenge" ? (
          <>
            <label className="note" htmlFor="lb-pick">
              Challenge{" "}
              <select id="lb-pick" className="input" value={challengeId} onChange={(e) => setPick(e.target.value)}>
                {library.map((c) => (
                  <option key={c.id} value={c.id}>
                    {pad3(c.number)} {c.title}
                  </option>
                ))}
              </select>
            </label>
            {challengeId ? <Board challengeId={challengeId} board="library" /> : null}
          </>
        ) : null}
      </main>
      <Footer />
    </div>
  );
}
