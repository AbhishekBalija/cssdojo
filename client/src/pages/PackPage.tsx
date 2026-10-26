import { Link, useParams } from "@tanstack/react-router";
import { SOLVED_AT, type PackBoardRow, type PackChallengeTile, type PackDetail } from "@cssdojo/shared";
import { BeltBand, BeltChip, BigCountdown, CLOTH, Hang, I, Mountain } from "@/components/Craft";
import { avatarColor, beltLine as packBeltLine } from "@/components/PackCard";
import { ago } from "@/components/Shell";
import { EmptyState } from "@/components/States";
import { staticUrl } from "@/lib/api";
import { packName, shortDate, usePack } from "@/lib/dojo";
import { useMe } from "@/lib/me";

const n3 = (n: number) => `#${String(n).padStart(3, "0")}`;
const fmt = (n: number) => n.toLocaleString("en-US");

function solvedOf(p: PackDetail) {
  const solved = p.challenges.filter((c) => c.best !== null && c.best >= SOLVED_AT).length;
  const tried = p.challenges.filter((c) => c.best !== null && c.best < SOLVED_AT).length;
  return { solved, tried };
}

function ChallengeCard({ c, next, start }: { c: PackChallengeTile; next: boolean; start: boolean }) {
  const solved = c.best !== null && c.best >= SOLVED_AT;
  const card = (
    <div className={`d-pcard${next ? " next" : ""}`}>
      <Link to="/c/$id" params={{ id: c.id }} className="thumb">
        <img src={staticUrl(`/targets/${c.id}/thumb.png`)} alt={c.title} style={{ background: c.background }} />
        <span className="n">{n3(c.number)}</span>
      </Link>
      <span className="ttl">
        {c.title}
        {next ? <span className="d-chip new">{start ? "Start" : "Next"}</span> : null}
      </span>
      <span className="st">
        {solved ? (
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="d-chip ok">Solved</span>
            <span className="d-mono sc-ok" style={{ fontSize: 15 }}>
              {c.best?.toFixed(1)}
            </span>
          </span>
        ) : c.best !== null ? (
          <span className="d-mono">
            <span className="sc-mid" style={{ fontSize: 15 }}>
              {c.best.toFixed(1)}
            </span>{" "}
            <span style={{ color: "var(--sub)", fontSize: 12 }}>needs {SOLVED_AT}</span>
          </span>
        ) : (
          <span className="d-mono" style={{ color: "var(--sub)" }}>
            Not played
          </span>
        )}
        {c.locked ? (
          <span className="d-chip warn" title="You opened solutions here, so your points on it are frozen.">
            {I.lock} Locked
          </span>
        ) : (
          <Link to="/c/$id" params={{ id: c.id }} className={`d-btn ${next ? "pri" : "sec"}`} style={{ height: 36, fontSize: 13, padding: "0 14px" }}>
            {solved ? "Improve" : c.best !== null ? "Retry" : (
              <>
                {I.play} Play
              </>
            )}
          </Link>
        )}
      </span>
      <span className="top">{c.top ? `Top ${c.top.score.toFixed(1)} · ${c.top.handle}` : "No scores yet. Be the first."}</span>
    </div>
  );
  return next ? <Hang>{card}</Hang> : card;
}

function Row({ r, live }: { r: PackBoardRow; live: boolean }) {
  return (
    <li className={`d-mini${r.me ? " me" : ""}`} style={{ gridTemplateColumns: "22px 22px minmax(0,1fr) auto", height: 42 }}>
      <span className="rn" style={{ color: r.rank <= 3 ? "var(--warn)" : undefined }}>
        {r.rank}
      </span>
      <span className="av" style={{ background: r.me ? "var(--line-strong)" : avatarColor(r.player.handle) }} />
      <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
        <Link to="/u/$handle" params={{ handle: r.player.handle }} className="nm">
          {r.player.handle}
        </Link>
        {r.player.belt ? <span className="d-tk" style={{ background: CLOTH[r.player.belt].acc }} /> : null}
        {live && r.moved > 0 ? <span className="d-up">▲{r.moved}</span> : null}
      </span>
      <span className="pt">{fmt(r.points)}</span>
    </li>
  );
}

function Podium({ rows }: { rows: PackBoardRow[] }) {
  const [a, b, c] = rows;
  if (!a) return null;
  const step = (r: PackBoardRow | undefined, h: number, place: number) =>
    r ? (
      <span className="step" key={place}>
        <i className="av" style={{ background: avatarColor(r.player.handle), width: place === 1 ? 34 : 28, height: place === 1 ? 34 : 28 }} />
        <span className="who">{r.player.handle}</span>
        <span className={`blk p${place}`} style={{ height: h }}>
          <b>{place}</b>
          <span>{fmt(r.points)}</span>
        </span>
      </span>
    ) : null;
  return (
    <div className="d-podium">
      <span className="champ">Champion · {a.player.handle}</span>
      <div className="steps">
        {step(b, 64, 2)}
        {step(a, 90, 1)}
        {step(c, 52, 3)}
      </div>
    </div>
  );
}

export function PackPage() {
  const { n } = useParams({ from: "/shell/packs/$n" });
  const num = Number(n);
  const q = usePack(num);
  const me = useMe();
  if (q.isLoading) return <div className="d-pg"><p className="note">Loading…</p></div>;
  const p = q.data;
  if (!p) {
    return (
      <div className="d-pg">
        <EmptyState title="That Battle Pack isn't here" action={<Link to="/packs" className="d-btn sec">All Battle Packs</Link>} />
      </div>
    );
  }
  const belt = p.belt ?? "white";
  const c = CLOTH[belt];
  const { solved, tried } = solvedOf(p);
  const nextC = p.challenges.find((x) => x.best === null || x.best < SOLVED_AT);
  const start = solved + tried === 0;
  const live = p.state === "live";
  const line = packBeltLine(belt, solved, me.data?.belts ?? []);
  const earned = line.done;
  const beltLine = line.text;
  const endDate = shortDate(p.endsAt).toUpperCase();
  const myRow = p.board.find((r) => r.me);
  const top = live ? p.board.slice(0, 5) : p.board.slice(3, 5);
  return (
    <div className="d-pg">
      <div className="d-glow" />
      <Mountain />
      <nav className="d-crumbs" aria-label="Breadcrumb">
        <Link to="/packs">Battle Packs</Link>
        <span aria-hidden="true">›</span>
        <b>{packName(p.number)}</b>
      </nav>
      {p.state === "upcoming" ? (
        <EmptyState title={`${packName(p.number)} opens soon`} action={<BigCountdown to={p.opensAt} />} />
      ) : (
        <>
          <section className="d-banded d-hero" style={{ ["--bm" as string]: c.md, ["--ba" as string]: c.acc }}>
            <BeltBand belt={belt} height={24} knotX={104} />
            <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
              <span style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {live ? <span className="d-chip ok d-lvdot">Live</span> : <span className="d-chip">Finished {endDate}</span>}
                <BeltChip belt={belt} />
                <span className="d-chip">{p.challenges.length} targets</span>
                {live ? <span className="d-chip">{fmt(p.players)} playing</span> : null}
              </span>
              <span className="d-kick">{packName(p.number)}</span>
              <h1 className="d-art">{p.title}</h1>
              <p style={{ margin: 0, maxWidth: 460, fontSize: 15, lineHeight: "23px", color: "var(--sub)" }}>
                {p.description}{" "}
                {live ? "The pack board is live until it ends, then it freezes as final standings." : "The pack board froze when it ended. You can still play, and new scores count on the Wall."}
              </p>
            </div>
            <div className="d-heroside">
              {live ? (
                <>
                  <span className="d-kick" style={{ color: "var(--sub)", alignSelf: "flex-end" }}>
                    Ends in
                  </span>
                  <span style={{ alignSelf: "flex-end" }}>
                    <BigCountdown to={p.endsAt} />
                  </span>
                </>
              ) : null}
              <span className="d-mono" style={{ fontSize: 12.5 }}>
                {solved} of {p.challenges.length} solved{tried ? <span style={{ color: "var(--sub)" }}> · {tried} tried</span> : null}
              </span>
              {!live ? (
                <span className="d-segs">
                  {p.challenges.map((x, i) => (
                    <i key={x.id} className={x.best === null ? "" : x.best >= SOLVED_AT ? "on" : "mid"} style={i === 4 ? { marginRight: 6 } : undefined} />
                  ))}
                </span>
              ) : null}
              <span style={{ fontSize: 13.5, color: earned ? "var(--pass)" : "var(--fg)" }}>{beltLine}</span>
              {nextC ? (
                <Link to="/c/$id" params={{ id: nextC.id }} className="d-btn pri" style={{ width: "100%" }}>
                  {I.play} {start ? "Start" : "Continue"} with {n3(nextC.number)}
                </Link>
              ) : null}
            </div>
          </section>
          <div className="d-packbody">
            <div className="d-pgrid">
              {p.challenges.map((x) => (
                <ChallengeCard key={x.id} c={x} next={x.id === nextC?.id} start={start} />
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <section className="d-card" style={{ gap: 10, padding: "18px 16px" }}>
                <h3 className="d-ch">
                  {live ? <span className="d-lvdot d-kick" style={{ letterSpacing: ".14em", fontSize: 10 }}>Live</span> : I.trophy}
                  <span>{live ? "Pack board" : "Final standings"}</span>
                  <span className="sp" />
                  <span className="meta">{p.players}</span>
                </h3>
                {!live ? <Podium rows={p.board} /> : null}
                <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                  {top.map((r) => (
                    <Row key={r.player.handle} r={r} live={live} />
                  ))}
                  {myRow && !top.includes(myRow) && myRow.rank > 3 ? (
                    <>
                      <li className="d-mono" style={{ color: "var(--faint)", padding: "0 8px" }}>
                        ···
                      </li>
                      <Row r={myRow} live={live} />
                    </>
                  ) : null}
                </ol>
                {!myRow ? <p className="d-dash">You're not on this board yet. One scored target puts you on it.</p> : null}
                <Link to="/leaderboard/packs" search={{ n: p.number }} className="d-lnk" style={{ margin: "4px 4px" }}>
                  {live ? "Full pack board" : `All ${p.players} players`} {I.arrow}
                </Link>
              </section>
              {live && p.moves.length ? (
                <section className="d-card" style={{ gap: 10, padding: "18px 16px" }}>
                  <h3 className="d-ch">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M3 20h18M5 16l5-6 4 3 6-8" />
                    </svg>
                    <span>Moves on this pack</span>
                  </h3>
                  <ul className="d-moves">
                    {p.moves.slice(0, 6).map((m) => (
                      <li key={m.id}>
                        <span className="d-tk" style={{ background: m.player?.belt ? CLOTH[m.player.belt].acc : "var(--accent)" }} />
                        <span className="tx">
                          {m.player ? <b>{m.player.handle}</b> : null} {m.text}
                        </span>
                        <span className="at">{ago(m.at)}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
              {!live ? (
                <section className="d-card" style={{ gap: 14, padding: "18px 16px" }}>
                  <h3 className="d-ch">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="3" y="3" width="18" height="18" rx="4" />
                      <path d="M8 12.5l3 3 5-6" />
                    </svg>
                    <span>How this pack works</span>
                  </h3>
                  <span className="d-how">{SOLVED_AT} or more counts as solved.</span>
                  <span className="d-how">Solve 5 of the 6 to earn {belt}.</span>
                  <span className="d-how">Ties go to whoever got there first.</span>
                </section>
              ) : null}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
