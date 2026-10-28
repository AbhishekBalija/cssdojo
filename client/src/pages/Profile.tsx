import { Link } from "@tanstack/react-router";
import { BADGE_GROUPS, BADGES, BELTS, SOLVED_AT, SOLVES_PER_BELT, type BadgeDef, type BadgeGroup, type BadgeView, type Belt, type ProfileView } from "@cssdojo/shared";
import { useId, type ReactNode } from "react";
import { CLOTH, I, Knot, Mountain } from "@/components/Craft";
import { scoreClass } from "@/components/KataStage";
import { initials } from "@/components/Shell";
import { EmptyState } from "@/components/States";
import { staticUrl } from "@/lib/api";
import { packName, shortDate, useProfile, usePacks } from "@/lib/dojo";
import { useMe } from "@/lib/me";
import { toast } from "@/lib/toast";

// Your profile and other players': the belt record, kata scores, checks,
// recent solves and badges (mockup v49).

const fmt = (n: number) => n.toLocaleString("en-US");
const cap = (s: string) => `${s[0]?.toUpperCase() ?? ""}${s.slice(1)}`;

function topBelt(belts: Belt[]): Belt | null {
  return [...BELTS].reverse().find((b) => belts.includes(b)) ?? null;
}

/** The long cloth belt across the profile card; stripes count solves toward the next belt. */
export function BigBelt({ belt, have }: { belt: Belt; have: number }) {
  const c = CLOTH[belt];
  const id = useId();
  return (
    <div style={{ position: "relative", height: 70 }} aria-hidden="true">
      <svg width="100%" height="34" viewBox="0 0 1000 34" preserveAspectRatio="none" style={{ display: "block", filter: "drop-shadow(0 8px 12px rgba(0,0,0,.45))" }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={c.lt} />
            <stop offset=".5" stopColor={c.md} />
            <stop offset="1" stopColor={c.dk} />
          </linearGradient>
        </defs>
        <rect width="1000" height="34" rx="3" fill={`url(#${id})`} />
        <path d="M0 17 H1000" stroke="rgba(12,13,16,.3)" strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
        <rect x="820" y="0" width="150" height="34" fill="#121317" />
        {Array.from({ length: SOLVES_PER_BELT }, (_, i) => (
          <rect key={i} x={834 + i * 26} y="0" width="12" height="34" fill={i < have ? "#F3F1EC" : "#22252C"} />
        ))}
        <path d="M0 .5 H1000" stroke="#fff" strokeOpacity=".3" vectorEffect="non-scaling-stroke" />
      </svg>
      <Knot belt={belt} x="36%" scale={1.25} />
    </div>
  );
}

function KataChart({ kata, joined }: { kata: ProfileView["kata"]; joined: string }) {
  const id = useId();
  // A narrow drawing keeps the text readable when the chart shrinks on a phone.
  const W = 360,
    H = 170,
    x0 = 30;
  // The scale starts at 70, or lower when a score falls below it, so every point sits where it really is.
  const low = Math.min(70, ...kata.map((k) => (k.score === null ? 100 : Math.floor(k.score / 10) * 10)));
  const y = (s: number) => 20 + ((100 - s) / (100 - low)) * 120;
  const ticks = [100, Math.round((100 + low) / 10) * 5, low];
  const joinDay = joined.slice(0, 10);
  const step = (W - x0 - 10) / Math.max(1, kata.length - 1);
  const pts = kata.map((k, i) => (k.score === null ? null : ([x0 + i * step, y(k.score)] as const)));
  const line = pts.filter((p): p is readonly [number, number] => p !== null);
  const d = line.map((p, i) => `${i ? "L" : "M"}${p[0]} ${p[1]}`).join(" ");
  const area = line.length ? `${d} L${line[line.length - 1]?.[0]} 140 L${line[0]?.[0]} 140Z` : "";
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Kata scores for the last 12 days">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#A99CFF" stopOpacity=".35" />
          <stop offset="1" stopColor="#A99CFF" stopOpacity="0" />
        </linearGradient>
      </defs>
      {ticks.map((v, i) => (
        <g key={v}>
          <text x="0" y={y(v) + 3} fontSize="10" fill="var(--faint)" fontFamily="Martian Mono">
            {v}
          </text>
          <path d={`M${x0 - 8} ${y(v)} H${W}`} stroke="var(--line)" strokeDasharray={i === 1 ? "3 3" : undefined} />
        </g>
      ))}
      <path d={area} fill={`url(#${id})`} />
      <path d={d} fill="none" stroke="#A99CFF" strokeWidth="1.8" />
      {kata.map((k, i) => {
        const p = pts[i];
        const x = x0 + i * step;
        const today = i === kata.length - 1;
        // Days before you joined are left blank; a missed day is a small hollow mark on the floor line.
        const mark = p ? (
          <circle cx={p[0]} cy={p[1]} r="3.5" fill="var(--bg)" stroke="#A99CFF" strokeWidth="1.5" />
        ) : k.date < joinDay || today ? null : (
          <circle cx={x} cy="140" r="2.5" fill="none" stroke="var(--faint)" strokeWidth="1.2">
            <title>Missed</title>
          </circle>
        );
        return (
          <g key={k.date}>
            {mark}
            {/* Every second day gets a label (counting back from today) so labels never touch. */}
            {(kata.length - 1 - i) % 2 === 0 ? (
              <text x={today ? x + 6 : x} y="162" fontSize="10" fill="var(--faint)" textAnchor={today ? "end" : "middle"} fontFamily="Martian Mono">
                {today ? "today" : Number(k.date.slice(8))}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

export const GROUP_COLOR: Record<BadgeGroup, string> = { belts: "#F2C94C", packs: "#A99CFF", challenges: "#F2C94C", streaks: "#5ED39A", practice: "#A99CFF", dojo: "#A99CFF" };

export function BadgeIcon({ b }: { b: BadgeDef }) {
  const p = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  if (b.group === "belts")
    return (
      <svg {...p}>
        <path d="M3 10.5h6.5M14.5 10.5H21" />
        <rect x="9.5" y="8" width="5" height="5" rx="1" fill="currentColor" />
        <path d="M11 13l-2.5 6M13 13l2.5 6" />
      </svg>
    );
  if (b.group === "packs")
    return (
      <svg {...p}>
        <rect x="4" y="4" width="6" height="6" rx="1" />
        <rect x="14" y="4" width="6" height="6" rx="1" />
        <rect x="4" y="14" width="6" height="6" rx="1" />
        <path d="M14 17l2 2 4-4" />
      </svg>
    );
  if (b.id === "perfect-100") return <span style={{ font: "700 11px/1 var(--font-mono)" }}>100</span>;
  if (b.group === "challenges")
    return (
      <svg {...p}>
        <path d="M5 12.5l4.5 4.5L19 7.5" />
      </svg>
    );
  if (b.group === "streaks")
    return (
      <svg {...p}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    );
  if (b.group === "practice")
    return (
      <svg {...p}>
        <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  return (
    <svg {...p}>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M7 12h10" />
    </svg>
  );
}

function Badge({ b, v }: { b: BadgeDef; v: BadgeView | undefined }) {
  const earned = !!v?.earnedAt;
  const color = b.group === "belts" ? CLOTH[b.id.slice(5) as Belt].acc : GROUP_COLOR[b.group];
  const sub = earned ? shortDate(v.earnedAt ?? "") : !b.enabled ? "soon" : b.goal && v?.progress !== null && v?.progress !== undefined ? `${v.progress} of ${b.goal}` : "locked";
  return (
    <span className={`d-badge${earned ? " on" : ""}`} title={b.description}>
      <span className="d-medal big" style={{ ["--c" as string]: earned ? color : "var(--line-strong)" }}>
        <BadgeIcon b={b} />
      </span>
      <b>{b.name}</b>
      <span>{sub}</span>
    </span>
  );
}

function Badges({ views, own }: { views: BadgeView[]; own: boolean }) {
  const byId = new Map(views.map((v) => [v.id, v]));
  const earned = BADGES.filter((b) => byId.get(b.id)?.earnedAt);
  const groups = BADGE_GROUPS.map((g) => [g, BADGES.filter((b) => b.group === g && (own || byId.get(b.id)?.earnedAt))] as const).filter(([, l]) => l.length);
  return (
    <section className="d-card">
      <h3 className="d-ch">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <circle cx="12" cy="9" r="6" />
          <path d="M9 14l-2 7 5-3 5 3-2-7" />
        </svg>
        <span>Badges</span>
        <span className="d-mono" style={{ color: "var(--sub)" }}>
          {earned.length} of {BADGES.length}
        </span>
      </h3>
      {groups.length ? (
        <div className="d-badgegroups">
          {groups.map(([g, list]) => (
            <div key={g} className="grp">
              <span className="d-kick" style={{ color: "var(--sub)", letterSpacing: ".18em", fontSize: 10.5 }}>
                {g === "packs" ? "Battle Packs" : g}
              </span>
              <div className="row">
                {list.map((b) => (
                  <Badge key={b.id} b={b} v={byId.get(b.id)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="note">No badges yet.</p>
      )}
    </section>
  );
}

function Card({ icon, title, right, children, style }: { icon: ReactNode; title: ReactNode; right?: ReactNode; children: ReactNode; style?: React.CSSProperties }) {
  return (
    <section className="d-card" style={style}>
      <h3 className="d-ch">
        {icon}
        <span>{title}</span>
        <span className="sp" />
        {right}
      </h3>
      {children}
    </section>
  );
}

function ProfileBody({ p, own }: { p: ProfileView; own: boolean }) {
  const packs = usePacks();
  const top = topBelt(p.belts);
  const next = BELTS.find((b) => !p.belts.includes(b)) ?? null;
  const have = next ? Math.min(SOLVES_PER_BELT, p.solvedPerBelt[next]) : SOLVES_PER_BELT;
  const cloth = top ?? "white";
  const c = CLOTH[cloth];
  const total = packs.data ? packs.data.reduce((n, x) => n + x.challenges.length, 0) : null;
  const nextPack = next ? packs.data?.find((x) => x.belt === next && x.state !== "upcoming") : undefined;
  const nextLeft = nextPack ? nextPack.challenges.filter((x) => x.best === null || x.best < SOLVED_AT).length : 0;
  const scored = p.kata.filter((k): k is { date: string; score: number } => k.score !== null);
  const avg = scored.length ? scored.reduce((s, k) => s + k.score, 0) / scored.length : null;
  const recent = [...p.bests].filter((b) => b.board === "library").sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 6);
  const share = () => {
    void navigator.clipboard?.writeText(`${location.origin}/u/${p.handle}`).then(
      () => toast("Profile link copied."),
      () => toast(`${location.origin}/u/${p.handle}`),
    );
  };
  return (
    <div className="d-pg">
      <div className="d-glow" />
      <Mountain />
      <section className="d-card d-prof" style={{ ["--b" as string]: c.acc }}>
        <div className="top">
          <span className="pring">{p.image ? <img src={p.image} alt="" /> : <span>{initials(p.handle)}</span>}</span>
          <span style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 0 }}>
            <span className="d-kick">{own ? "Profile" : "Player"}</span>
            <h1 className="d-art" style={{ fontSize: 52, lineHeight: "56px", overflow: "hidden", textOverflow: "ellipsis" }}>
              {p.handle}
            </h1>
            <span className="d-mono" style={{ fontSize: 13 }}>
              {p.wallRank ? `#${p.wallRank} on the wall` : "Not on the wall yet"} <i className="dot">·</i> {fmt(p.points)} pts <i className="dot">·</i> {p.solved}
              {total ? ` of ${total}` : ""} solved <i className="dot">·</i> <span style={{ color: "var(--sub)" }}>since {shortDate(p.joined)}</span>
            </span>
          </span>
          <span style={{ display: "flex", gap: 8 }}>
            {own ? (
              <Link to="/settings" className="d-btn sec">
                Settings
              </Link>
            ) : null}
            <button type="button" className="d-btn sec" onClick={share}>
              Share
            </button>
          </span>
        </div>
        <BigBelt belt={cloth} have={have} />
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }} data-testid="belt-progress">
          <b style={{ fontSize: 15 }}>{top ? `${cap(top)} belt` : "No belt yet"}</b>
          <span style={{ fontSize: 14, color: "var(--sub)", flex: 1 }}>
            {next
              ? `${have} of ${SOLVES_PER_BELT} ${next} solves.${own && nextPack && nextLeft ? ` ${Math.min(nextLeft, SOLVES_PER_BELT - have)} more in ${packName(nextPack.number)} earn ${next}.` : ""}`
              : "Every belt earned."}
          </span>
          {own && nextPack ? (
            <Link to="/packs/$n" params={{ n: String(nextPack.number) }} className="d-btn out">
              Open {packName(nextPack.number)} ›
            </Link>
          ) : null}
        </div>
      </section>
      <div className="d-prof2">
        <Card
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 20h18M5 16l5-6 4 3 6-8" />
            </svg>
          }
          title="Kata scores, last 12 days"
          right={
            avg !== null ? (
              <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                <b style={{ font: "600 20px/1 var(--font-ui)" }}>{avg.toFixed(1)}</b>
                <span style={{ fontSize: 11, color: "var(--sub)", marginTop: 4 }}>average</span>
              </span>
            ) : null
          }
        >
          {scored.length ? <KataChart kata={p.kata} joined={p.joined} /> : <p className="note">No kata played in the last 12 days.</p>}
        </Card>
        <Card
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="4" />
              <path d="M8 12.5l3 3 5-6" />
            </svg>
          }
          title="Checks passed"
          right={<span className="meta">of scored Submits</span>}
        >
          {p.checks.length ? (
            <div className="d-checkbars">
              {p.checks.map((ch) => {
                const pct = Math.round(ch.passRate * 100);
                const col = pct >= 80 ? "linear-gradient(90deg,#2F8F5B,#5ED39A)" : pct >= 55 ? "linear-gradient(90deg,#9A6A2A,#F2C07B)" : "linear-gradient(90deg,#9A3F6A,#F59AC5)";
                return (
                  <span key={ch.id} className="r">
                    <span className="l">{ch.label}</span>
                    <span className="w-bar" style={{ height: 5 }}>
                      <span style={{ width: `${pct}%`, background: col, boxShadow: "none" }} />
                    </span>
                    <span className="v">{pct}%</span>
                  </span>
                );
              })}
            </div>
          ) : (
            <p className="note">Checks show up after the first scored Submit.</p>
          )}
        </Card>
      </div>
      <Card
        icon={I.grid}
        title={
          <>
            Recent solves{" "}
            <span className="d-mono" style={{ color: "var(--sub)" }}>
              {p.solved}
              {total ? ` of ${total}` : ""}
            </span>
          </>
        }
        right={
          own ? (
            <Link to="/packs" className="d-lnk">
              All Battle Packs {I.arrow}
            </Link>
          ) : null
        }
      >
        {recent.length ? (
          <div className="d-grid6">
            {recent.map((b) => (
              <Link key={b.challengeId} to="/c/$id" params={{ id: b.challengeId }} className="d-tile">
                <img src={staticUrl(`/targets/${b.challengeId}/thumb.png`)} alt={b.title} loading="lazy" />
                <span className="n">#{String(b.number).padStart(3, "0")}</span>
                <span className={`s ${scoreClass(b.score)}`}>{b.score.toFixed(1)}</span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="note">No solves yet.</p>
        )}
      </Card>
      {p.packs.length ? (
        <Card icon={I.trophy} title="Battle Pack finishes">
          <div className="d-finishes">
            {p.packs.map((x) => (
              <Link key={x.number} to="/packs/$n" params={{ n: String(x.number) }} className="r">
                <span className="d-mono k">{String(x.number).padStart(2, "0")}</span>
                <span className="t">{x.title}</span>
                {x.live ? <span className="d-chip new">LIVE</span> : null}
                <span className="d-mono v">
                  #{x.rank} <span style={{ color: "var(--sub)" }}>of {fmt(x.players)}</span>
                </span>
              </Link>
            ))}
          </div>
        </Card>
      ) : null}
      <Badges views={p.badges} own={own} />
    </div>
  );
}

export function PublicProfile({ handle }: { handle: string }) {
  const me = useMe();
  const q = useProfile(handle);
  if (q.isError) {
    return (
      <div className="d-pg">
        <EmptyState title={`No player called ${handle}`} action={<Link to="/leaderboard" className="d-btn sec">Back to the Wall</Link>} />
      </div>
    );
  }
  if (!q.data) return <div className="d-pg" />;
  return <ProfileBody p={q.data} own={me.data?.user?.handle === handle} />;
}

/** Your own page: the profile when signed in, otherwise a sign-in prompt over your guest progress. */
export function MyProfile() {
  const me = useMe();
  const handle = me.data?.user?.handle ?? null;
  if (handle) return <PublicProfile handle={handle} />;
  return (
    <div className="d-pg">
      <div className="d-glow" />
      <Mountain />
      <div className="d-ph">
        <span className="d-kick">Profile</span>
        <h1>Your progress</h1>
        <p className="sub">You are playing as a guest. Sign in to keep this progress on any device, appear on the boards and keep a kata streak.</p>
      </div>
      <Link to="/signin" search={{ next: "/me" }} className="d-btn pri" style={{ alignSelf: "flex-start" }}>
        Sign in
      </Link>
    </div>
  );
}
