import { Link } from "@tanstack/react-router";
import { BADGES, BELTS, SOLVED_AT, type Belt, type PackSummary, type PublicChallenge, type ScoreResult, type SubmitRanking } from "@cssdojo/shared";
import { useEffect, useRef, type ReactNode } from "react";
import { pad3 } from "@/lib/belts";
import { packName } from "@/lib/dojo";
import { useMe } from "@/lib/me";
import { toast } from "@/lib/toast";
import { BadgeIcon, BigBelt, GROUP_COLOR } from "@/pages/Profile";
import { CLOTH, Hang, I } from "./Craft";

// The two moments after a Submit: the result card hanging from the rod, and
// the belt earned card when a fifth solve lands. Both are modal.

type Scored = Extract<ScoreResult, { status: "scored" }>;

const fmt = (n: number) => n.toLocaleString("en-US");

function Modal({ label, lamp, onClose, children }: { label: string; lamp: number; onClose: () => void; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    box.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="d-modal" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={box} className="d-modalbox" role="dialog" aria-modal="true" aria-label={label} style={{ ["--lamp" as string]: lamp }}>
        {children}
      </div>
    </div>
  );
}

function ScoreRing({ score }: { score: number }) {
  const r = 54;
  const len = 2 * Math.PI * r;
  const col = score >= SOLVED_AT ? "var(--pass)" : "var(--warn)";
  return (
    <span className="d-ring" aria-label={`Score ${score}`}>
      <svg width="128" height="128" viewBox="0 0 128 128" aria-hidden="true">
        <circle cx="64" cy="64" r={r} fill="none" stroke="var(--line)" strokeWidth="7" />
        <circle cx="64" cy="64" r={r} fill="none" stroke={col} strokeWidth="7" strokeLinecap="round" strokeDasharray={`${(len * score) / 100} ${len}`} transform="rotate(-90 64 64)" className="arc" />
      </svg>
      <span className="v">
        <b className="d-mono">{score >= 100 ? "100" : score.toFixed(1)}</b>
        <span>score</span>
      </span>
    </span>
  );
}

export function ResultCard({
  c,
  r,
  ranking,
  newBest,
  chars,
  pack,
  next,
  onClose,
}: {
  c: PublicChallenge;
  r: Scored;
  ranking: SubmitRanking | undefined;
  newBest: boolean;
  chars: number;
  pack: PackSummary | undefined;
  next: { id: string; number: number } | undefined;
  onClose: () => void;
}) {
  const me = useMe();
  const guest = !me.data?.user;
  const solved = r.score >= SOLVED_AT;
  const runChecks = r.checks.filter((x) => x.id !== "hooks-present");
  const wall = ranking?.wall ?? null;
  const packMove = ranking?.pack ?? null;
  const badges = (ranking?.badgesEarned ?? []).map((id) => BADGES.find((b) => b.id === id)).filter((b) => b !== undefined);
  const packTotal = pack?.challenges.length ?? 6;
  return (
    <Modal label={`Result for ${c.title}`} lamp={solved ? 1 : 0.2} onClose={onClose}>
      <Hang>
        <section className="d-card d-result">
          <div className="top">
            <ScoreRing score={r.score} />
            <span className="hd">
              <span className="chips">
                {solved ? <span className="d-chip ok">SOLVED</span> : <span className="d-chip warn">UNDER 90</span>}
                {newBest ? <span className="d-chip new">NEW BEST</span> : null}
                {ranking?.locked ? <span className="d-chip">LOCKED</span> : null}
              </span>
              <h2 className="d-art">{c.title}</h2>
              <span className="d-mono meta">
                {ranking && wall ? (
                  <>
                    <b style={{ color: ranking.gained > 0 ? "var(--pass)" : "var(--sub)" }}>{ranking.gained > 0 ? `+${fmt(ranking.gained)} pts` : `${fmt(ranking.points)} pts`}</b>
                    <i>·</i> of {fmt(ranking.maxPoints)} <i>·</i>{" "}
                  </>
                ) : null}
                {r.visual}% match <i>·</i> {fmt(chars)} chars
              </span>
            </span>
          </div>
          <div className="cols">
            <div className="d-sub">
              <span className="lb">
                Technique checks · {r.checksPassed - (r.checks.find((x) => x.id === "hooks-present")?.pass ? 1 : 0)} of {runChecks.length}
              </span>
              {runChecks.length ? (
                <ul className="d-checklist">
                  {runChecks.map((ch, i) => (
                    <li key={ch.id} className={ch.pass ? "ok" : "miss"} style={{ animationDelay: `${i * 30}ms` }}>
                      <i aria-hidden="true">{ch.pass ? "✓" : "!"}</i>
                      <span>
                        {ch.label}
                        {!ch.pass && ch.hint ? <small>{ch.hint}</small> : null}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="note">This target is about the look only.</p>
              )}
            </div>
            <div className="d-sub">
              <span className="lb">What it moved</span>
              {packMove ? (
                <div className="mv">
                  <span className="d-mono">
                    {packName(packMove.number)} <i>·</i> {packMove.solved} of {packTotal} solved
                  </span>
                  <span className="d-segs">
                    {Array.from({ length: packTotal }, (_, i) => (
                      <i key={i} className={i < packMove.solved ? "on" : ""} />
                    ))}
                  </span>
                </div>
              ) : null}
              {wall ? (
                <div className="mv">
                  <span className="d-mono">
                    The Wall <i>·</i> {fmt(wall.before)} → {fmt(wall.after)}
                  </span>
                  <span className="tx">
                    {wall.passed.length ? `Past ${listNames(wall.passed)}. ` : ""}
                    {wall.rankBefore && wall.rankAfter && wall.rankAfter < wall.rankBefore
                      ? `You move from #${wall.rankBefore} to #${wall.rankAfter}.`
                      : wall.rankAfter
                        ? `You are #${wall.rankAfter}.`
                        : "Sign in to get on the Wall."}
                  </span>
                </div>
              ) : null}
              {ranking?.streakCounted ? (
                <div className="mv">
                  <span className="d-mono">Streak</span>
                  <span className="tx">Today counts for your streak.</span>
                </div>
              ) : null}
              {badges.map((b) => (
                <div key={b.id} className="mv row">
                  <span className="d-medal" style={{ ["--c" as string]: GROUP_COLOR[b.group] }}>
                    <BadgeIcon b={b} />
                  </span>
                  <span className="tx">
                    <b>{b.name}</b> badge earned
                  </span>
                </div>
              ))}
              {!packMove && !wall && !ranking?.streakCounted && !badges.length ? (
                guest && solved && !ranking?.locked ? (
                  <p className="note">
                    Solved and saved on this browser. <Link to="/signin" search={{ next: `/c/${c.id}` }}>Sign in</Link> to earn its points and get on the Wall.
                  </p>
                ) : (
                  <p className="note">{ranking?.locked ? "Points here are locked: you opened solutions." : "Nothing moved this time."}</p>
                )
              ) : null}
            </div>
          </div>
          <div className="acts">
            {next && solved ? (
              <Link to="/c/$id" params={{ id: next.id }} className="d-btn pri grow" onClick={onClose} data-autofocus>
                Next target · {pad3(next.number)} {I.arrow}
              </Link>
            ) : null}
            <button type="button" className={`d-btn ${next && solved ? "sec" : "pri grow"}`} onClick={onClose} {...(next && solved ? {} : { "data-autofocus": true })}>
              Keep improving
            </button>
            <Link to="/c/$id/solutions" params={{ id: c.id }} className="d-btn out">
              Solutions
            </Link>
          </div>
        </section>
      </Hang>
    </Modal>
  );
}

function listNames(names: string[]): string {
  if (names.length <= 1) return names.join("");
  if (names.length <= 3) return `${names.slice(0, -1).join(", ")} and ${names.at(-1) ?? ""}`;
  return `${names.slice(0, 2).join(", ")} and ${names.length - 2} more`;
}

export function BeltEarned({ belt, pack, onClose }: { belt: Belt; pack: PackSummary | undefined; onClose: () => void }) {
  const c = CLOTH[belt];
  const next = BELTS[BELTS.indexOf(belt) + 1];
  const nextMax: Record<Belt, number> = { white: 200, yellow: 400, green: 600, brown: 800, black: 1000 };
  const share = () => {
    const url = `${location.origin}/me`;
    void navigator.clipboard?.writeText(`I earned the ${belt} belt on CSS Dojo. ${url}`).then(
      () => toast("Copied. Paste it anywhere."),
      () => toast(url),
    );
  };
  return (
    <Modal label={`${belt} belt earned`} lamp={1} onClose={onClose}>
      <Hang>
        <section className="d-card d-beltwin" style={{ ["--b" as string]: c.acc }}>
          <span className="d-kick" style={{ color: belt === "white" ? "var(--sub)" : c.acc }}>
            Belt earned
          </span>
          <h2 className="d-art">{belt[0]?.toUpperCase() + belt.slice(1)} belt</h2>
          <BigBelt belt={belt} have={0} />
          <p>
            Five solves at {SOLVED_AT} or more{pack ? ` in ${packName(pack.number)}` : ""}.{next ? ` ${next[0]?.toUpperCase() + next.slice(1)} is next, with targets worth up to ${fmt(nextMax[next])} points.` : " That is every belt in the dojo."}
          </p>
          <span className="badge">
            <span className="d-medal" style={{ ["--c" as string]: c.acc }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                <path d="M3 10.5h6.5M14.5 10.5H21" />
                <rect x="9.5" y="8" width="5" height="5" rx="1" fill="currentColor" />
                <path d="M11 13l-2.5 6M13 13l2.5 6" />
              </svg>
            </span>
            Badge added to your profile
          </span>
          <div className="acts">
            <Link to="/me" className="d-btn pri grow" onClick={onClose} data-autofocus>
              See your belt
            </Link>
            <button type="button" className="d-btn sec" onClick={share}>
              Share
            </button>
            <button type="button" className="d-btn sec" onClick={onClose}>
              Back to the target
            </button>
          </div>
        </section>
      </Hang>
    </Modal>
  );
}
