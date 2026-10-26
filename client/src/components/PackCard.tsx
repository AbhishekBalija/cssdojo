import { Link } from "@tanstack/react-router";
import { BELTS, SOLVED_AT, type Belt, type PackChallengeTile, type PackSummary } from "@cssdojo/shared";
import { packName } from "@/lib/dojo";
import { useMe } from "@/lib/me";
import { BeltBand, BeltChip, BigCountdown, CLOTH, I, untilLabel, useNow } from "./Craft";
import { HoverThumb } from "./HoverThumb";
import { scoreClass } from "./KataStage";

// One Battle Pack as a belt-banded card (Home and the Battle Packs list), and
// the dashed "upcoming" card with its countdown and Notify me.

/** A stable colour for a player's avatar dot. */
export function avatarColor(handle: string): string {
  const pal = ["#4A3F8C", "#3C6E5A", "#8A5A3C", "#2F5E7A", "#6A3F5C", "#3F5C5A", "#5C5A2E", "#3F5C8C", "#5A3F3F"];
  let h = 0;
  for (const ch of handle) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return pal[h % pal.length] ?? "#2E323A";
}

export function PackTile({ c }: { c: PackChallengeTile }) {
  return (
    <Link to="/c/$id" params={{ id: c.id }} className="d-tile">
      <HoverThumb id={c.id} title={c.title} background={c.background} />
      <span className="n">#{String(c.number).padStart(3, "0")}</span>
      <span className={`s ${scoreClass(c.best)}`}>{c.best === null ? "New" : c.best.toFixed(1)}</span>
      {c.locked ? <span className="locked">LOCKED</span> : null}
    </Link>
  );
}

export function beltLine(belt: Belt, solved: number, earned: Belt[]): { text: string; done: boolean } {
  if (earned.includes(belt)) return { text: `${belt[0]?.toUpperCase()}${belt.slice(1)} belt earned`, done: true };
  const prev = BELTS[BELTS.indexOf(belt) - 1];
  if (prev && !earned.includes(prev)) return { text: `5 of 6 earn ${belt}, after ${prev}`, done: false };
  const left = Math.max(0, 5 - solved);
  return { text: `${left} more solve${left === 1 ? "" : "s"} earn ${belt}`, done: false };
}

export function PackCard({ p }: { p: PackSummary }) {
  const me = useMe();
  const now = useNow(60_000);
  const belt = p.belt ?? "white";
  const c = CLOTH[belt];
  const solved = p.challenges.filter((x) => x.best !== null && x.best >= SOLVED_AT).length;
  const tried = p.challenges.filter((x) => x.best !== null && x.best < SOLVED_AT).length;
  const line = beltLine(belt, solved, me.data?.belts ?? []);
  const leaders = [...new Set(p.challenges.flatMap((x) => (x.top ? [x.top.handle] : [])))].slice(0, 3);
  const first = p.challenges.find((x) => x.best === null || x.best < SOLVED_AT) ?? p.challenges[0];
  const cta = solved === p.challenges.length ? "Improve scores" : solved + tried === 0 ? "Play" : "Continue";
  return (
    <article className="d-banded" style={{ ["--bm" as string]: c.md, ["--ba" as string]: c.acc, display: "grid", gridTemplateColumns: "minmax(0,300px) minmax(0,1fr)", gap: 28 }}>
      <BeltBand belt={belt} />
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <span style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {p.state === "live" ? (
            <>
              <span className="d-chip ok d-lvdot">Live</span>
              <span className="d-chip">Ends in {untilLabel(p.endsAt, now)}</span>
            </>
          ) : (
            <span className="d-chip">Finished</span>
          )}
          {solved === p.challenges.length ? <span className="d-chip ok">All solved</span> : null}
          <BeltChip belt={belt} />
        </span>
        <h2 style={{ margin: 0, font: "italic 400 30px/34px var(--font-art)", color: "var(--d-title)" }}>
          <Link to="/packs/$n" params={{ n: String(p.number) }} style={{ color: "inherit", textDecoration: "none" }}>
            {packName(p.number)}
            <br />
            {p.title}
          </Link>
        </h2>
        <p style={{ margin: 0, fontSize: 13.5, lineHeight: "21px", color: "var(--sub)" }}>{p.description}</p>
        <span style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 12, borderTop: "1px solid var(--d-rule)" }}>
          <span className="d-mono" style={{ fontSize: 12 }}>
            {solved} of {p.challenges.length} solved{tried ? <span style={{ color: "var(--sub)" }}> · {tried} tried</span> : null}
          </span>
          <span className="d-segs" aria-hidden="true">
            {p.challenges.map((x, i) => (
              <i key={x.id} className={x.best === null ? "" : x.best >= SOLVED_AT ? "on" : "mid"} style={i === 4 ? { marginRight: 6 } : undefined} />
            ))}
          </span>
          <span className="d-mono" style={{ fontSize: 11.5, color: line.done ? "var(--pass)" : "var(--sub)" }}>
            {line.text}
          </span>
        </span>
        <span style={{ flex: 1 }} />
        <span style={{ display: "flex", gap: 8 }}>
          <Link to="/leaderboard/packs" search={{ n: p.number }} className="d-btn sec" style={{ gap: 8 }}>
            Leaders
            {leaders.length ? (
              <span className="d-avs">
                {leaders.map((h) => (
                  <i key={h} style={{ background: avatarColor(h) }} title={h} />
                ))}
              </span>
            ) : null}
          </Link>
          {first ? (
            <Link to="/c/$id" params={{ id: first.id }} className={`d-btn ${cta === "Improve scores" ? "sec" : "pri"}`} style={{ flex: 1 }}>
              {cta}
            </Link>
          ) : null}
        </span>
      </div>
      <div className="d-grid3">
        {p.challenges.map((x) => (
          <PackTile key={x.id} c={x} />
        ))}
      </div>
    </article>
  );
}

export function UpcomingPack({ p, onNotify }: { p: PackSummary; onNotify: (on: boolean) => void }) {
  const notify = p.me?.notify ?? false;
  return (
    <article className="d-card d-upcoming" style={{ padding: "28px 24px", border: "1px dashed var(--line-strong)", background: "repeating-linear-gradient(135deg,var(--d-card-a) 0 10px,var(--d-card-b) 10px 20px)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
        <span className="d-round" style={{ width: 44, height: 44, cursor: "default", color: "var(--sub)" }} aria-hidden="true">
          {I.lock}
        </span>
        <span style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1, minWidth: 220 }}>
          <span className="d-chip" style={{ alignSelf: "flex-start" }}>
            Upcoming
          </span>
          <h2 style={{ margin: 0, font: "italic 400 28px/32px var(--font-art)", color: "var(--d-title)" }}>
            {packName(p.number)} · {p.title}
          </h2>
          <span style={{ fontSize: 13, color: "var(--sub)" }}>Six targets. The belt is revealed when it opens.</span>
        </span>
        <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 12 }}>
          <span className="d-kick" style={{ color: "var(--sub)" }}>
            Opens in
          </span>
          <BigCountdown to={p.opensAt} />
          <button type="button" className="d-btn out" style={{ height: 36, fontSize: 13 }} aria-pressed={notify} onClick={() => onNotify(!notify)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
              <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
            </svg>
            {notify ? "We'll tell you" : "Notify me"}
          </button>
        </span>
      </div>
    </article>
  );
}
