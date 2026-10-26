import { useQueryClient } from "@tanstack/react-query";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { BELTS, type Belt, type EventView, type MeView, type NotificationView } from "@cssdojo/shared";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useEvents, useNotifications } from "@/lib/dojo";
import { useGuestMerge, useMe } from "@/lib/me";
import { loadTasks, onTasks, TASKS, type Tasks } from "@/lib/tasks";
import { storage } from "@/lib/storage";
import { CLOTH, I } from "./Craft";

// The app frame from the approved mockup: sidebar on the left, a header with the
// LIVE line, the hanging streak tag, the bell and you, and the page below.

/** "4m", "2h", "yesterday", "2 Nov". */
export function ago(iso: string, now = Date.now()): string {
  const s = Math.max(0, (now - Date.parse(iso)) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 172800) return "yesterday";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

export function initials(name: string): string {
  const parts = name.replace(/[^a-zA-Z0-9 ._-]/g, "").split(/[ ._-]+/).filter(Boolean);
  const a = parts[0]?.[0] ?? "?";
  const b = parts[1]?.[0] ?? parts[0]?.[1] ?? "";
  return (a + b).toUpperCase();
}

/** Highest belt earned, and the next one with progress (5 solves each). */
export function beltProgress(me: Pick<MeView, "belts" | "solvedPerBelt"> | undefined): { top: Belt | null; next: Belt | null; have: number } {
  const earned = me?.belts ?? [];
  const top = [...BELTS].reverse().find((b) => earned.includes(b)) ?? null;
  const next = BELTS.find((b) => !earned.includes(b)) ?? null;
  return { top, next, have: next ? Math.min(5, me?.solvedPerBelt[next] ?? 0) : 5 };
}

function BeltStrip({ belt, have }: { belt: Belt; have: number }) {
  const c = CLOTH[belt];
  const knot = 16 + (have / 5) * 110;
  return (
    <span style={{ position: "relative", display: "block", height: 16 }} aria-hidden="true">
      <svg viewBox="0 0 180 16" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: 16, overflow: "visible" }}>
        <defs>
          <linearGradient id="sbb" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={c.lt} />
            <stop offset=".5" stopColor={c.md} />
            <stop offset="1" stopColor={c.dk} />
          </linearGradient>
        </defs>
        <rect x="0" y="2" width="180" height="12" rx="2" fill="url(#sbb)" />
        <path d="M0 8 H180" stroke="rgba(12,13,16,.3)" strokeDasharray="3 2" />
        <rect x="142" y="2" width="34" height="12" fill="#121317" />
        {Array.from({ length: have }, (_, i) => (
          <rect key={i} x={146 + i * 6} y="2" width="4" height="12" fill="#F3F1EC" />
        ))}
        <g transform={`translate(${knot} -2)`}>
          <path d="M5 10 L1 22 L5 23 L8 12Z" fill={c.dk} />
          <path d="M12 11 L16 22 L20 21 L15 9Z" fill={c.dk} />
          <rect x="3" y="0" width="15" height="15" rx="3" fill="url(#sbb)" />
          <rect x="3.5" y=".5" width="14" height="14" rx="2.5" fill="none" stroke="#fff" strokeOpacity=".3" />
        </g>
      </svg>
    </span>
  );
}

function GetStarted() {
  const [tasks, setTasks] = useState<Tasks>(loadTasks);
  const [open, setOpen] = useState(false);
  useEffect(() => onTasks(setTasks), []);
  const done = TASKS.filter(([k]) => tasks[k]).length;
  if (done === TASKS.length) return null;
  const p = done / TASKS.length;
  return (
    <div className="grp sub" style={{ position: "relative" }}>
      <span className="lbl">Get started</span>
      <button type="button" className="d-nav" style={{ height: 36, border: 0, background: "none", width: "100%", cursor: "pointer", textAlign: "left" }} aria-expanded={open} onClick={() => setOpen(!open)}>
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="9" fill="none" stroke="var(--line-strong)" strokeWidth="3" />
          <circle cx="12" cy="12" r="9" fill="none" stroke="var(--pass)" strokeWidth="3" strokeDasharray={`${p * 56.5} 56.5`} transform="rotate(-90 12 12)" />
        </svg>
        <span className="grow">
          {done}/{TASKS.length} done
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--sub)" strokeWidth="2" aria-hidden="true" style={{ rotate: open ? "90deg" : "0deg", transition: "rotate .15s" }}>
          <path d="M9 6l6 6-6 6" />
        </svg>
      </button>
      {open ? (
        <div style={{ display: "grid", gap: 2, paddingBottom: 6 }}>
          {TASKS.map(([k, b, s]) => (
            <div key={k} className={`task${tasks[k] ? " done" : ""}`}>
              <i>✓</i>
              <div>
                <b>{b}</b>
                <span>{s}</span>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const me = useMe();
  const { top, next, have } = beltProgress(me.data);
  const playedToday = me.data?.streakDetail?.playedToday ?? false;
  const bp = top ?? "white";
  return (
    <nav className="d-side" aria-label="Main" onClick={(e) => (e.target as HTMLElement).closest("a") && onNavigate?.()}>
      <Link to="/" className="logo" aria-label="CSS Dojo home">
        <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
          <rect x="2" y="4" width="20" height="16" rx="4" fill="none" stroke="currentColor" strokeWidth="2" />
          <rect x="2" y="10" width="20" height="4" fill="var(--accent)" />
        </svg>
        <span>
          <span className="css">css</span>dojo
        </span>
      </Link>
      <div className="grp">
        <Link to="/" className="d-nav" activeOptions={{ exact: true }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
          </svg>
          Home
        </Link>
      </div>
      <GetStarted />
      <div className="grp">
        <span className="lbl">Play</span>
        <Link to="/kata" className="d-nav">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path d="M3 10h18M8 3v4M16 3v4" />
          </svg>
          <span className="grow">Daily kata</span>
          {playedToday ? null : <span className="dot" aria-label="Today's kata not played yet" />}
        </Link>
        <Link to="/packs" className="d-nav">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
          <span className="grow">Battle Packs</span>
        </Link>
        <Link to="/leaderboard" className="d-nav">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z" />
            <path d="M17 5h3a3 3 0 0 1-3 4M7 5H4a3 3 0 0 0 3 4" />
          </svg>
          Leaderboards
        </Link>
        <Link to="/me" className="d-nav">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21a8 8 0 0 1 16 0" />
          </svg>
          Profile
        </Link>
      </div>
      <div style={{ flexGrow: 1 }} />
      <Link to="/me" className="d-beltcard" style={{ ["--b" as string]: CLOTH[top ?? "white"].acc }}>
        <span className="t">
          {top ? `${top[0]?.toUpperCase()}${top.slice(1)} belt` : "No belt yet"}
          {next ? (
            <span>
              {have}/5 to {next}
            </span>
          ) : (
            <span>all belts</span>
          )}
        </span>
        <BeltStrip belt={bp} have={have} />
        <span className="f">{next ? `${have} solved of 5 ${next}` : "Every belt earned"}</span>
      </Link>
    </nav>
  );
}

function StreakTag() {
  const me = useMe();
  const d = me.data?.streakDetail;
  const current = d?.current ?? me.data?.streak ?? 0;
  const played = d?.playedToday ?? false;
  const broken = current === 0;
  const edge = broken ? "rgba(255,255,255,0.22)" : "rgba(94,211,154,0.55)";
  const label = broken ? "No streak yet" : `${current} day streak, ${played ? "played" : "not played"} today`;
  const note = broken
    ? "Submit an attempt on today's kata to start one."
    : played
      ? `Played today. Come back tomorrow for ${current + 1}.`
      : "Submit an attempt on today's kata before 00:00 UTC to keep it.";
  const days = ["M", "T", "W", "T", "F", "S", "S"];
  return (
    <span className="d-streak">
      <Link to="/kata" aria-label={label}>
        <span className="d-stag">
          <svg className="shape" width="72" height="132" viewBox="0 0 72 132" aria-hidden="true">
            <defs>
              <linearGradient id="stf" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor={broken ? "rgba(255,255,255,0.08)" : "rgba(94,211,154,0.16)"} />
                <stop offset="1" stopColor={broken ? "rgba(255,255,255,0.02)" : "rgba(94,211,154,0.04)"} />
              </linearGradient>
              <linearGradient id="sts" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#C9CDD6" />
                <stop offset="1" stopColor="#8F939C" />
              </linearGradient>
            </defs>
            <path d="M36 4 C 30 16, 31 34, 36 44" fill="none" stroke="#6A6E78" strokeWidth="1.6" strokeLinecap="round" />
            <path d="M36 32 L60 50 Q63 52 63 56 V104 Q63 108 60 110 L36 128 L12 110 Q9 108 9 104 V56 Q9 52 12 50 Z" fill="#14161A" />
            <path d="M36 32 L60 50 Q63 52 63 56 V104 Q63 108 60 110 L36 128 L12 110 Q9 108 9 104 V56 Q9 52 12 50 Z" fill="url(#stf)" stroke={edge} strokeWidth="1" />
            <path d="M14 53 L36 36.5" stroke="rgba(255,255,255,0.22)" strokeWidth="1" strokeLinecap="round" />
            <circle cx="36" cy="44" r="3.2" fill="#0C0D10" stroke={edge} strokeWidth="1" />
            <path d="M36 4 C 42 16, 41 34, 36 44" fill="none" stroke="url(#sts)" strokeWidth="1.6" strokeLinecap="round" />
            <circle cx="36" cy="4" r="3.2" fill="#8F939C" />
            <circle cx="35.2" cy="3.2" r="1" fill="#ECEAE4" />
          </svg>
          <span className="in">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={broken ? "#8F939C" : "#5ED39A"} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {played ? <path d="M5 12.5l4.5 4.5L19 7.5" strokeWidth="3" /> : (
                <>
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 2" />
                </>
              )}
            </svg>
            <span className="n">{current}</span>
          </span>
        </span>
      </Link>
      <div className="pop" role="tooltip">
        <span className="row">
          <span>{broken ? "No streak yet" : `${current} day streak`}</span>
          <span>Best {Math.max(d?.best ?? 0, current)}</span>
        </span>
        {d ? (
          <span className="wk" aria-label="This week">
            {d.week.map((s, i) => (
              <span key={i}>
                {days[i]}
                <i className={s === "done" ? "done" : s === "today" ? "today" : undefined} />
              </span>
            ))}
          </span>
        ) : null}
        <span className="note">{note}</span>
      </div>
    </span>
  );
}

const NOTE_COLOR: Record<NotificationView["kind"], string> = { passed: "#F2C94C", badge: "#5ED39A", belt: "#F2C94C", "pack-open": "#A99CFF", "pack-soon": "#A99CFF" };

function NoteIcon({ kind }: { kind: NotificationView["kind"] }) {
  const p = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  if (kind === "passed")
    return (
      <svg {...p}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 16V8M8.5 11.5L12 8l3.5 3.5" />
      </svg>
    );
  if (kind === "pack-soon")
    return (
      <svg {...p}>
        <rect x="6" y="11" width="12" height="9" rx="2" />
        <path d="M9 11V8a3 3 0 0 1 6 0v3" />
      </svg>
    );
  if (kind === "pack-open") return I.grid;
  if (kind === "belt")
    return (
      <svg {...p}>
        <path d="M4 9h16M12 9v3M9 20l3-8 3 8" />
      </svg>
    );
  return (
    <svg {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function Bell() {
  const n = useNotifications();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);
  const unread = n.data?.unread ?? 0;
  const markAll = async () => {
    await api("/notifications/read", { method: "POST", json: {} }).catch(() => undefined);
    void qc.invalidateQueries({ queryKey: ["notifications"] });
    void qc.invalidateQueries({ queryKey: ["me"] });
  };
  return (
    <div className="d-bellwrap" ref={wrap}>
      <button type="button" className="d-round" aria-label={unread ? `Notifications, ${unread} new` : "Notifications"} aria-expanded={open} onClick={() => setOpen(!open)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unread ? <span className="pip" /> : null}
      </button>
      {open ? (
        <section className="d-card d-bellpop" aria-label="Notifications">
          <h3 className="d-ch">
            <span>Notifications</span>
            <span className="sp" />
            {unread ? (
              <button type="button" className="d-lnk" style={{ fontSize: 12 }} onClick={() => void markAll()}>
                Mark all read
              </button>
            ) : null}
          </h3>
          {n.data && n.data.items.length ? (
            <ul>
              {n.data.items.map((it) => {
                const inner = (
                  <>
                    <span className="d-medal sm" style={{ ["--c" as string]: NOTE_COLOR[it.kind] }}>
                      <NoteIcon kind={it.kind} />
                    </span>
                    <span style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      <b>{it.title}</b>
                      <span className="body">{it.body}</span>
                    </span>
                    <span className="when">
                      {ago(it.createdAt)}
                      {it.read ? null : <i />}
                    </span>
                  </>
                );
                return (
                  <li key={it.id}>
                    {it.href ? (
                      <a className={`d-note${it.read ? "" : " unread"}`} href={it.href} onClick={() => setOpen(false)}>
                        {inner}
                      </a>
                    ) : (
                      <div className={`d-note${it.read ? "" : " unread"}`}>{inner}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="note" style={{ margin: "6px 14px 10px" }}>
              Nothing yet. When someone passes you, a pack opens or you earn a badge, it shows up here.
            </p>
          )}
          <Link to="/me" className="d-lnk" style={{ margin: "8px 14px 4px" }} onClick={() => setOpen(false)}>
            All badges {I.arrow}
          </Link>
        </section>
      ) : null}
    </div>
  );
}

/** One big moment at a time, flipping every 6 s, paused on hover. Hidden when there is nothing live. */
function Announcer() {
  const ev = useEvents();
  const items: EventView[] = ev.data ?? [];
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused || items.length < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % items.length), 6000);
    return () => clearInterval(t);
  }, [paused, items.length]);
  const e = items[i % Math.max(1, items.length)];
  if (!e) return <span />;
  return (
    <a className="d-ann" href={e.href ?? "/leaderboard"} aria-live="polite" title="Pauses on hover. Opens the board." onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <span className="lv">LIVE</span>
      <span className="sep" />
      <span className="win">
        <span className="ln" key={e.id}>
          <span className="d-tk" style={{ background: CLOTH[e.player?.belt ?? "white"].acc }} />
          {e.player ? <b>{e.player.handle}</b> : null} {e.text}
        </span>
      </span>
    </a>
  );
}

/** Rich toasts for new "passed you", badge and belt notifications (each shown once per browser). */
function NoticeToasts() {
  const n = useNotifications();
  const [shown, setShown] = useState<NotificationView[]>([]);
  useEffect(() => {
    const items = n.data?.items ?? [];
    let seen: string[] = [];
    try {
      seen = JSON.parse(storage.get("dojo-toasted") ?? "[]") as string[];
    } catch {
      seen = [];
    }
    const fresh = items.filter((it) => !it.read && !seen.includes(it.id) && (it.kind === "passed" || it.kind === "badge" || it.kind === "belt") && Date.now() - Date.parse(it.createdAt) < 3_600_000);
    if (!fresh.length) return;
    storage.set("dojo-toasted", JSON.stringify([...seen, ...fresh.map((f) => f.id)].slice(-100)));
    setShown((s) => [...s, ...fresh.slice(0, 2)]);
  }, [n.data]);
  useEffect(() => {
    if (!shown.length) return;
    const t = setTimeout(() => setShown((s) => s.slice(1)), 8000);
    return () => clearTimeout(t);
  }, [shown]);
  const drop = (id: string) => setShown((s) => s.filter((x) => x.id !== id));
  return (
    <div className="d-toasts" aria-live="polite">
      {shown.map((t) =>
        t.kind === "passed" ? (
          <div key={t.id} className="d-toast" style={{ ["--c" as string]: "#F2C94C" }}>
            <span className="row">
              <span className="txt">
                <b>{t.title}</b> {t.body}
              </span>
            </span>
            <span className="btns">
              {t.href ? (
                <a className="d-btn pri" href={t.href} style={{ flex: 1 }}>
                  Take it back
                </a>
              ) : null}
              <button type="button" className="d-btn sec" onClick={() => drop(t.id)}>
                Later
              </button>
            </span>
          </div>
        ) : (
          <div key={t.id} className="d-toast" style={{ ["--c" as string]: "#5ED39A" }} onClick={() => drop(t.id)}>
            <span className="row">
              <span className="d-medal" style={{ ["--c" as string]: "#5ED39A", width: 44, height: 44, borderWidth: 2 }}>
                <NoteIcon kind={t.kind} />
              </span>
              <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span className="d-kick" style={{ fontSize: 9.5, letterSpacing: ".16em" }}>
                  {t.kind === "belt" ? "Belt earned" : "Badge earned"}
                </span>
                <b style={{ font: "600 14px/18px var(--font-ui)" }}>{t.title}</b>
              </span>
            </span>
          </div>
        ),
      )}
    </div>
  );
}

function Account() {
  const me = useMe();
  const user = me.data?.user ?? null;
  const here = useRouterState({ select: (st) => st.location.href });
  if (!user) {
    return (
      <Link to="/signin" search={here === "/" || here.startsWith("/signin") ? {} : { next: here }} className="d-btn sec" style={{ height: 36, fontSize: 13 }}>
        Sign in
      </Link>
    );
  }
  return (
    <Link to="/me" className="d-round" aria-label="Your profile" style={{ background: "var(--line-strong)" }}>
      {user.image ? <img src={user.image} alt="" /> : initials(user.handle ?? user.name)}
    </Link>
  );
}

export function TopBar() {
  return (
    <header className="d-head">
      <Announcer />
      <StreakTag />
      <span className="end">
        <Bell />
        <Account />
      </span>
    </header>
  );
}

/** The layout for every page except the play screen. */
export function AppShell() {
  useGuestMerge();
  const [navOpen, setNavOpen] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });
  useEffect(() => setNavOpen(false), [path]);
  return (
    <div className={`d-shell${navOpen ? " nav-open" : ""}`}>
      <Sidebar onNavigate={() => setNavOpen(false)} />
      <main className="d-main">
        <div style={{ position: "relative" }}>
          <button type="button" className="d-round d-hamb" aria-label="Menu" onClick={() => setNavOpen(true)} style={{ position: "absolute", left: 12, top: 10, zIndex: 4 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
          <TopBar />
        </div>
        <Outlet />
      </main>
      <NoticeToasts />
    </div>
  );
}
