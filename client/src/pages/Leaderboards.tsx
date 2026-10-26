import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { BELTS, type Belt, type EventView, type PlayerTag, type WallRow, type WallView } from "@cssdojo/shared";
import { useId, useState, type ReactNode } from "react";
import { CLOTH, GlideTabs, Page, untilLabel, useNow } from "@/components/Craft";
import { useChallenges } from "@/components/KataStage";
import { avatarColor } from "@/components/PackCard";
import { ago, initials } from "@/components/Shell";
import { staticUrl } from "@/lib/api";
import { packName, useChallengeBoard, usePack, usePacks, useStreakBoard, useWall } from "@/lib/dojo";
import { useMe } from "@/lib/me";

// Leaderboards: The Wall (all-time points, one ranking with belt-tinted banners),
// one Battle Pack's board, one challenge's board, and streaks.

const fmt = (n: number) => n.toLocaleString("en-US");
type Tab = "wall" | "pack" | "challenge" | "streaks";

function Tabs({ tab }: { tab: Tab }) {
  const packs = usePacks();
  const live = packs.data?.find((p) => p.state === "live") ?? packs.data?.find((p) => p.state === "finished");
  return (
    <GlideTabs>
      <Link to="/leaderboard" role="tab" aria-selected={tab === "wall"} activeOptions={{ exact: true }}>
        All-time
      </Link>
      <Link to="/leaderboard/packs" search={live ? { n: live.number } : {}} role="tab" aria-selected={tab === "pack"}>
        {live ? packName(live.number) : "Battle Pack"}
      </Link>
      <Link to="/leaderboard/challenges" search={{}} role="tab" aria-selected={tab === "challenge"}>
        By challenge
      </Link>
      <Link to="/leaderboard/streaks" role="tab" aria-selected={tab === "streaks"}>
        Streaks
      </Link>
    </GlideTabs>
  );
}

function Frame({ tab, children }: { tab: Tab; children: ReactNode }) {
  return (
    <Page kicker="Leaderboards" title="The Wall" tabs={<Tabs tab={tab} />}>
      {children}
    </Page>
  );
}

export function Avatar({ p, me, size = 26 }: { p: PlayerTag; me?: boolean; size?: number }) {
  if (p.image) return <img src={p.image} alt="" width={size} height={size} style={{ borderRadius: "50%", flex: "none" }} />;
  if (me)
    return (
      <span className="d-av" style={{ width: size, height: size, background: "var(--line-strong)" }}>
        {initials(p.handle)}
      </span>
    );
  return <span className="d-av" style={{ width: size, height: size, background: avatarColor(p.handle) }} />;
}

function Pennant({ belt }: { belt: Belt | null }) {
  const c = CLOTH[belt ?? "white"];
  const id = useId();
  return (
    <svg width="18" height="24" viewBox="0 0 18 24" aria-hidden="true" style={{ flex: "none" }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={c.lt} />
          <stop offset="1" stopColor={c.dk} />
        </linearGradient>
      </defs>
      <path d="M1 1H17V18L9 23L1 18Z" fill={`url(#${id})`} stroke="rgba(0,0,0,.35)" />
      <path d="M1 1.5H17" stroke="#fff" strokeOpacity=".35" />
    </svg>
  );
}

function Banner({ r, place }: { r: WallRow; place: number }) {
  const belt = r.player.belt ?? "white";
  const c = CLOTH[belt];
  const H = place === 1 ? 176 : 150;
  const g = useId();
  const shape = `M4 2 H196 L192 ${H - 34} Q191 ${H - 28} 185 ${H - 27} L100 ${H - 2} L15 ${H - 27} Q9 ${H - 28} 8 ${H - 34} Z`;
  return (
    <div className="w-tb">
      <span className="w-lamp" />
      <span className="w-hook" />
      <span className="w-rod" />
      <div className="w-ban" style={{ height: H, color: c.ink }}>
        <svg viewBox={`0 0 200 ${H}`} preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id={`${g}f`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={c.lt} />
              <stop offset=".5" stopColor={c.md} />
              <stop offset="1" stopColor={c.dk} />
            </linearGradient>
            <linearGradient id={`${g}s`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#000" stopOpacity=".38" />
              <stop offset=".14" stopColor="#000" stopOpacity="0" />
              <stop offset=".32" stopColor="#fff" stopOpacity=".10" />
              <stop offset=".5" stopColor="#000" stopOpacity="0" />
              <stop offset=".7" stopColor="#fff" stopOpacity=".07" />
              <stop offset=".86" stopColor="#000" stopOpacity="0" />
              <stop offset="1" stopColor="#000" stopOpacity=".38" />
            </linearGradient>
          </defs>
          <path d={shape} fill={`url(#${g}f)`} />
          <path d={shape} fill={`url(#${g}s)`} />
          <path d="M4 2.5 H196" stroke="#fff" strokeOpacity=".35" vectorEffect="non-scaling-stroke" />
          <path d={`M15 ${H - 27} L100 ${H - 2} L185 ${H - 27}`} fill="none" stroke="#000" strokeOpacity=".35" vectorEffect="non-scaling-stroke" />
          <path d={`M14 10 V${H - 36} M186 10 V${H - 36}`} stroke={c.ink} strokeOpacity=".18" strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
        </svg>
        <div className="w-in">
          {place === 1 ? <span className="d-kick" style={{ color: c.ink, opacity: 0.8, fontSize: 9.5, letterSpacing: ".24em" }}>Top of the wall</span> : null}
          <span className="w-rk">{place}</span>
          <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Avatar p={r.player} me={r.me} size={38} />
            <span style={{ display: "flex", flexDirection: "column", gap: 4, textAlign: "left" }}>
              <Link to="/u/$handle" params={{ handle: r.player.handle }} className="w-nm" style={{ color: "inherit", textDecoration: "none" }}>
                {r.player.handle}
              </Link>
              <span className="w-pt">{fmt(r.points)} pts</span>
            </span>
          </span>
        </div>
      </div>
      <span className="d-chip" style={{ marginTop: 12 }}>
        <span className="bd" style={{ background: c.acc }} />
        {belt} belt
      </span>
    </div>
  );
}

function WallLine({ r }: { r: WallRow }) {
  const belt = r.player.belt;
  const acc = CLOTH[belt ?? "white"].acc;
  return (
    <li className={`w-r${r.me ? " me" : ""}${r.moved > 0 ? " moved" : ""}`}>
      <span className="rn">{r.rank}</span>
      <Pennant belt={belt} />
      <Avatar p={r.player} me={r.me} />
      <span className="nm">
        <Link to="/u/$handle" params={{ handle: r.player.handle }}>
          {r.player.handle}
          {r.me ? <span style={{ color: "var(--sub)" }}> (you)</span> : null}
        </Link>
        {belt ? <span className="bl">{belt}</span> : null}
        {r.moved > 0 ? (
          <span className="upm" style={{ color: acc, background: `color-mix(in srgb,${acc} 14%,transparent)` }}>
            ▲{r.moved}
          </span>
        ) : null}
      </span>
      <span className="pt">{fmt(r.points)}</span>
    </li>
  );
}

export function Moves({ moves }: { moves: EventView[] }) {
  if (!moves.length) return null;
  return (
    <div className="d-movestrip" aria-label="Recent moves">
      <span className="k">Recent moves</span>
      {moves.slice(0, 5).map((m) => {
        const acc = CLOTH[m.player?.belt ?? "white"].acc;
        return (
          <span key={m.id} className="m">
            <span className="d-tk" style={{ background: m.kind === "pack-open" ? "var(--accent)" : acc }} />
            {m.player ? <b>{m.player.handle}</b> : null}
            {m.kind === "moved" && m.delta ? (
              <>
                <span style={{ font: "500 10.5px/1 var(--font-mono)", color: acc }}>▲{m.delta}</span> to #{m.rank}
              </>
            ) : (
              m.text
            )}
            <em>{ago(m.at)}</em>
          </span>
        );
      })}
    </div>
  );
}

function Cylinder({ belt, h, count }: { belt: Belt; h: number; count: number }) {
  const tone: Record<Belt, [string, string]> = { white: ["#B9B3A8", "#FBF8F1"], yellow: ["#B38A1C", "#F5D468"], green: ["#1E6B44", "#56C48A"], brown: ["#6A4029", "#C98A5A"], black: ["#25272D", "#C3C7D0"] };
  const [dk, lt] = tone[belt];
  const id = useId();
  return (
    <div className="w-ped">
      <svg className="cyl" viewBox={`0 0 100 ${h}`} preserveAspectRatio="none" style={{ height: h }} aria-hidden="true">
        <defs>
          <linearGradient id={`${id}b`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor={dk} stopOpacity=".55" />
            <stop offset=".32" stopColor={lt} stopOpacity=".42" />
            <stop offset=".62" stopColor={dk} stopOpacity=".35" />
            <stop offset="1" stopColor="#0C0D10" stopOpacity=".7" />
          </linearGradient>
          <linearGradient id={`${id}f`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <mask id={`${id}m`}>
            <rect x="0" y="0" width="100" height={h} fill={`url(#${id}f)`} />
          </mask>
          <radialGradient id={`${id}t`} cx=".4" cy=".4" r=".8">
            <stop offset="0" stopColor={lt} />
            <stop offset="1" stopColor={dk} />
          </radialGradient>
        </defs>
        <g mask={`url(#${id}m)`}>
          <path d={`M2 22 V${h} H98 V22Z`} fill={`url(#${id}b)`} />
          <path d={`M2 22 V${h}`} stroke={lt} strokeOpacity=".35" />
          <path d={`M98 22 V${h}`} stroke="#000" strokeOpacity=".4" />
        </g>
        <ellipse cx="50" cy="22" rx="48" ry="10" fill={`url(#${id}t)`} />
        <ellipse cx="50" cy="22" rx="48" ry="10" fill="none" stroke={lt} strokeOpacity=".8" />
        <path d="M2 22 A48 10 0 0 0 98 22" fill="none" stroke="#000" strokeOpacity=".35" />
      </svg>
      <span className="medal" style={{ ["--m" as string]: lt, bottom: h - 28 }}>
        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
          <path d="M3 10.5h6.5M14.5 10.5H21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <rect x="9.5" y="8" width="5" height="5" rx="1" fill="currentColor" />
          <path d="M11 13l-2.5 6M13 13l2.5 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </span>
      <div className="pl" style={{ bottom: h - 80 }}>
        <b>{belt[0]?.toUpperCase() + belt.slice(1)}</b>
        <span>
          {fmt(count)} player{count === 1 ? "" : "s"}
        </span>
      </div>
    </div>
  );
}

function Trio({ w }: { w: WallView }) {
  const me = w.me;
  const myBelt = me?.player.belt ?? "white";
  const c = CLOTH[myBelt];
  const next = w.next;
  const pct = next && me ? Math.max(4, Math.min(100, Math.round((me.points / next.row.points) * 100))) : 100;
  return (
    <div className="w-trio">
      <section className="d-card">
        <h3 className="d-ch">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 21V4h14v17l-7-4z" />
          </svg>
          <span>Your place on the wall</span>
        </h3>
        {me ? (
          <>
            <div className="w-you">
              <svg className="rib" width="72" height="112" viewBox="0 0 72 112" aria-hidden="true">
                <defs>
                  <linearGradient id="rg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor={c.lt} />
                    <stop offset="1" stopColor={c.dk} />
                  </linearGradient>
                </defs>
                <path d="M4 0H68V108L36 90L4 108Z" fill="url(#rg)" />
                <path d="M4 0V108M68 0V108" stroke="#fff" strokeOpacity=".3" />
                <circle cx="36" cy="46" r="20" fill="#14161A" stroke={c.lt} strokeWidth="1.5" />
                <text x="36" y="53.5" textAnchor="middle" fontFamily="Onest" fontWeight="700" fontSize={me.rank > 99 ? 15 : 21} fill="#F3F1EC">
                  {me.rank}
                </text>
              </svg>
              <div className="yd">
                <b>
                  {me.player.handle} <span>(you)</span>
                </b>
                <span className="d-mono">
                  {fmt(me.points)} pts <span style={{ color: "var(--d-dim)", margin: "0 6px" }}>·</span>
                  <span style={{ color: "var(--sub)" }}>
                    {me.rank} / {fmt(w.players)}
                  </span>
                </span>
                <span className="w-bar">
                  <span style={{ width: `${Math.max(3, 100 - ((me.rank - 1) / Math.max(1, w.players)) * 100)}%` }} />
                </span>
              </div>
            </div>
            {next ? (
              <div className="w-nx">
                <span>
                  <em>Next rank</em>
                  {fmt(next.gap)} pts to pass {next.row.player.handle}
                </span>
              </div>
            ) : (
              <div className="w-nx">
                <span>
                  <em>Top of the wall</em>Nobody above you.
                </span>
              </div>
            )}
          </>
        ) : (
          <p className="note">Score 51 or more on any Battle Pack challenge to get on the wall.</p>
        )}
      </section>
      <section className="d-card">
        <h3 className="d-ch">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 20V5M6 11l6-6 6 6" />
          </svg>
          <span>Next name up</span>
        </h3>
        {next ? (
          <>
            <div className="w-up">
              <span className="w-ring">{next.row.rank}</span>
              <div>
                <b>{next.row.player.handle}</b>
                <span className="d-mono">
                  {fmt(next.row.points)} pts <span style={{ color: "var(--d-dim)", margin: "0 6px" }}>·</span>
                  <span style={{ color: "var(--sub)" }}>{next.row.player.belt ?? "no"} belt</span>
                </span>
                <span className="w-bar lil">
                  <span style={{ width: `${pct}%` }} />
                </span>
              </div>
            </div>
            <Link to="/packs" className="d-btn out" style={{ marginTop: "auto", alignSelf: "flex-start" }}>
              Close the gap ›
            </Link>
          </>
        ) : (
          <p className="note">{me ? "You're at the top. Hold it." : "Play a Battle Pack to see who's next."}</p>
        )}
      </section>
      <section className="d-card">
        <h3 className="d-ch">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 10h18v4H3z" />
            <path d="M10 10l2 3 2-3M11 14l-2 6M13 14l2 6" />
          </svg>
          <span>Belts on the wall</span>
        </h3>
        <div className="w-peds">
          {BELTS.map((b, i) => (
            <Cylinder key={b} belt={b} h={94 + i * 28} count={w.belts[b]} />
          ))}
        </div>
      </section>
    </div>
  );
}

export function WallBoard() {
  const [page, setPage] = useState(1);
  const q = useWall(page);
  const w = q.data;
  const rows = w?.rows ?? [];
  const top = page === 1 ? rows.slice(0, 3) : [];
  const rest = page === 1 ? rows.slice(3) : rows;
  const half = Math.ceil(rest.length / 2);
  const pages = w ? Math.max(1, Math.ceil(w.players / 50)) : 1;
  return (
    <Frame tab="wall">
      {w ? <Moves moves={w.moves} /> : null}
      <section className="d-card w-board">
        <div className="w-meta">
          {w ? `${fmt(w.players)} players` : "Loading"}
          <i>·</i>ranked by all-time points<i>·</i>ties go to whoever got there first
        </div>
        {w === null ? <p className="note">The Wall opens with the first Battle Pack.</p> : null}
        {top.length ? (
          <div className="w-top">
            {top[1] ? <Banner r={top[1]} place={2} /> : <span />}
            {top[0] ? <Banner r={top[0]} place={1} /> : null}
            {top[2] ? <Banner r={top[2]} place={3} /> : <span />}
          </div>
        ) : null}
        {rest.length ? (
          <div className="w-list">
            <ol start={rest[0]?.rank}>
              {rest.slice(0, half).map((r) => (
                <WallLine key={r.player.handle} r={r} />
              ))}
            </ol>
            <ol start={rest[half]?.rank}>
              {rest.slice(half).map((r) => (
                <WallLine key={r.player.handle} r={r} />
              ))}
            </ol>
          </div>
        ) : null}
        {w && w.me && !rows.some((r) => r.me) ? (
          <ol className="w-list" style={{ gridTemplateColumns: "1fr", borderTop: 0, paddingTop: 4, marginTop: 0 }}>
            <WallLine r={w.me} />
          </ol>
        ) : null}
        {w && rows.length ? (
          <div className="w-foot">
            <span>
              Showing {rows[0]?.rank} to {rows[rows.length - 1]?.rank} of {fmt(w.players)}
            </span>
            {pages > 1 ? (
              <span style={{ display: "flex", gap: 6 }}>
                {Array.from({ length: Math.min(pages, 5) }, (_, i) => i + 1).map((p) => (
                  <button key={p} type="button" className="d-chip" style={{ opacity: p === page ? 1 : 0.6, cursor: "pointer" }} aria-current={p === page} onClick={() => setPage(p)}>
                    {p}
                  </button>
                ))}
              </span>
            ) : null}
          </div>
        ) : null}
      </section>
      {w ? <Trio w={w} /> : null}
    </Frame>
  );
}

function Table({ cols, children }: { cols: [string, string][]; children: ReactNode }) {
  return (
    <section className="d-card" style={{ padding: "14px 10px" }}>
      <div className="t-row t-head" style={{ gridTemplateColumns: cols.map((c) => c[1]).join(" ") }}>
        {cols.map(([l]) => (
          <span key={l}>{l}</span>
        ))}
      </div>
      {children}
    </section>
  );
}

function Who({ p, me }: { p: PlayerTag; me: boolean }) {
  return (
    <span className="who">
      <Avatar p={p} me={me} />
      <Link to="/u/$handle" params={{ handle: p.handle }}>
        {p.handle}
        {me ? " (you)" : ""}
      </Link>
      {p.belt ? <span className="d-tk" style={{ background: CLOTH[p.belt].acc }} /> : null}
    </span>
  );
}

const rankColor = (r: number) => (r <= 3 ? "var(--warn)" : undefined);

export function PackBoardPage() {
  const s = useSearch({ from: "/shell/leaderboard/packs" });
  const navigate = useNavigate();
  const packs = usePacks();
  const n = s.n ?? packs.data?.find((p) => p.state === "live")?.number ?? packs.data?.find((p) => p.state === "finished")?.number ?? 0;
  const q = usePack(n);
  const now = useNow(60_000);
  const p = q.data;
  const cols: [string, string][] = [
    ["#", "36px"],
    ["Player", "minmax(0,1fr)"],
    ["Solved", "80px"],
    ["Points", "90px"],
  ];
  const mine = p?.board.find((r) => r.me);
  return (
    <Frame tab="pack">
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <label className="d-select">
          <span className="d-tk" style={{ background: p?.belt ? CLOTH[p.belt].acc : "var(--sub)" }} />
          <select value={n} onChange={(e) => void navigate({ to: "/leaderboard/packs", search: { n: Number(e.target.value) } })} aria-label="Battle Pack">
            {(packs.data ?? [])
              .filter((x) => x.state !== "upcoming")
              .map((x) => (
                <option key={x.number} value={x.number}>
                  {packName(x.number)} · {x.title}
                </option>
              ))}
          </select>
        </label>
        {p ? (
          <span className="d-mono" style={{ fontSize: 12, color: "var(--sub)", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            {p.state === "live" ? <span className="d-chip ok d-lvdot">Live</span> : <span className="d-chip">Final</span>}
            {p.state === "live" ? `ends in ${untilLabel(p.endsAt, now)}` : "board frozen at the end"} · {fmt(p.players)} players · ties go to whoever got there first
          </span>
        ) : null}
      </div>
      {p ? <Moves moves={p.moves} /> : null}
      <Table cols={cols}>
        {(p?.board ?? []).map((r) => (
          <div key={r.player.handle} className={`t-row${r.me ? " me" : ""}`} style={{ gridTemplateColumns: cols.map((c) => c[1]).join(" ") }}>
            <span className="rn" style={{ color: rankColor(r.rank) }}>
              {r.rank}
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              <Who p={r.player} me={r.me} />
              {r.moved > 0 ? <span className="d-up">▲{r.moved}</span> : null}
            </span>
            <span className="num">{r.solved}/6</span>
            <span className="num">{fmt(r.points)}</span>
          </div>
        ))}
        {p && !p.board.length ? <p className="note" style={{ padding: "8px 12px" }}>No scores on this pack yet.</p> : null}
      </Table>
      {p && !mine ? (
        <div className="d-card" style={{ flexDirection: "row", alignItems: "center", gap: 14, padding: "14px 16px" }}>
          <span style={{ flex: 1, fontSize: 13.5, color: "var(--d-ink)" }}>You haven't played this pack yet. One scored target puts you on the board.</span>
          <Link to="/packs/$n" params={{ n: String(p.number) }} className="d-btn pri" style={{ height: 36, fontSize: 13 }}>
            Open {packName(p.number)}
          </Link>
        </div>
      ) : null}
    </Frame>
  );
}

export function ChallengeBoardPage() {
  const s = useSearch({ from: "/shell/leaderboard/challenges" });
  const navigate = useNavigate();
  const list = useChallenges();
  const packs = usePacks();
  const options = (list.data ?? []).filter((c) => c.kind === "challenge");
  const id = s.id ?? options[0]?.id ?? "";
  const ch = options.find((c) => c.id === id);
  const q = useChallengeBoard(id);
  const pack = packs.data?.find((p) => p.challenges.some((c) => c.id === id));
  const cols: [string, string][] = [
    ["#", "36px"],
    ["Player", "minmax(0,1fr)"],
    ["Match", "80px"],
    ["Points", "80px"],
    ["Chars", "70px"],
  ];
  return (
    <Frame tab="challenge">
      <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
        {ch ? <img src={staticUrl(`/targets/${ch.id}/thumb.png`)} alt="" width={120} height={90} style={{ borderRadius: 10, border: "1px solid var(--d-tile-line)", background: ch.background }} /> : null}
        <span style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <label className="d-select" style={{ minWidth: 300 }}>
            <select value={id} onChange={(e) => void navigate({ to: "/leaderboard/challenges", search: { id: e.target.value } })} aria-label="Challenge">
              {options.map((c) => (
                <option key={c.id} value={c.id}>
                  #{String(c.number).padStart(3, "0")} {c.title}
                </option>
              ))}
            </select>
          </label>
          <span className="d-mono" style={{ fontSize: 12, color: "var(--sub)" }}>
            {pack ? `${packName(pack.number)} · ` : ""}
            {q.data ? `${q.data.length} players · ` : ""}ties go to whoever got there first
          </span>
        </span>
      </div>
      <Table cols={cols}>
        {(q.data ?? []).map((r) => (
          <div key={r.player.handle} className={`t-row${r.me ? " me" : ""}`} style={{ gridTemplateColumns: cols.map((c) => c[1]).join(" ") }}>
            <span className="rn" style={{ color: rankColor(r.rank) }}>
              {r.rank}
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              <Who p={r.player} me={r.me} />
              {r.moved > 0 ? <span className="d-up">▲{r.moved}</span> : null}
            </span>
            <span className="num">{r.score.toFixed(1)}</span>
            <span className="num">{fmt(r.points)}</span>
            <span className="num" style={{ color: "var(--sub)" }}>
              {r.chars}
            </span>
          </div>
        ))}
        {q.data && !q.data.length ? <p className="note" style={{ padding: "8px 12px" }}>No signed-in scores yet. Be the first.</p> : null}
      </Table>
    </Frame>
  );
}

export function StreakBoardPage() {
  const q = useStreakBoard();
  const me = useMe();
  const cols: [string, string][] = [
    ["#", "36px"],
    ["Player", "minmax(0,1fr)"],
    ["Current", "80px"],
    ["Longest", "80px"],
  ];
  const rows = q.data ?? [];
  const top = rows.filter((r) => r.rank <= 10);
  const mine = rows.find((r) => r.me && r.rank > 10);
  return (
    <Frame tab="streaks">
      <p className="d-mono" style={{ margin: 0, fontSize: 12.5, color: "var(--sub)" }}>
        Days in a row with an attempt on the daily kata, any score <span style={{ color: "var(--d-dim)", margin: "0 6px" }}>·</span> ties go to whoever started first
      </p>
      <Table cols={cols}>
        {top.map((r) => (
          <div key={r.player.handle} className={`t-row${r.me ? " me" : ""}`} style={{ gridTemplateColumns: cols.map((c) => c[1]).join(" ") }}>
            <span className="rn" style={{ color: rankColor(r.rank) }}>
              {r.rank}
            </span>
            <Who p={r.player} me={r.me} />
            <span className="num">{r.current}</span>
            <span className="num">{r.longest}</span>
          </div>
        ))}
        {mine ? (
          <>
            <div className="t-row" style={{ color: "var(--faint)" }}>
              ···
            </div>
            <div className={`t-row me`} style={{ gridTemplateColumns: cols.map((c) => c[1]).join(" ") }}>
              <span className="rn">{mine.rank}</span>
              <Who p={mine.player} me />
              <span className="num">{mine.current}</span>
              <span className="num">{mine.longest}</span>
            </div>
          </>
        ) : null}
        {q.data && !rows.length ? (
          <p className="note" style={{ padding: "8px 12px" }}>
            No streaks yet. {me.data?.user ? "Submit today's kata to start one." : "Sign in and submit today's kata to start one."}
          </p>
        ) : null}
      </Table>
    </Frame>
  );
}

