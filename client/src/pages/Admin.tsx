import { Link } from "@tanstack/react-router";
import {
  AdminReasonSchema,
  type AdminChallengeRow,
  type AdminHideRequest,
  type AdminPackRow,
  type AdminPlayerDetail,
  type AdminReasonOnlyRequest,
  type PackDatesRequest,
} from "@cssdojo/shared";
import { useState, type FormEvent, type ReactNode } from "react";
import { GlideTabs, Page } from "@/components/Craft";
import { EmptyState, ErrorState } from "@/components/States";
import { ApiError } from "@/lib/api";
import {
  useAdminActions,
  useAdminChallenges,
  useAdminPacks,
  useAdminPlayer,
  useAdminPlayerSearch,
  useAdminStats,
  useAdminWrite,
  useIsAdmin,
} from "@/lib/admin";
import { useMe } from "@/lib/me";

// Admin panel (docs/requirements/admin.md): schedule, challenges, players, health
// and the audit log. Challenge content is written in git, never here.

export type AdminTab = "schedule" | "challenges" | "players" | "health" | "log";
export const ADMIN_TABS: AdminTab[] = ["schedule", "challenges", "players", "health", "log"];
const TAB_LABEL: Record<AdminTab, string> = { schedule: "Schedule", challenges: "Challenges", players: "Players", health: "Health", log: "Audit log" };

function errorText(e: unknown): string {
  return e instanceof ApiError ? e.message : "Something went wrong. Try again.";
}

/**
 * Every admin write asks for a short reason first; it goes into the audit log.
 * `children` holds any extra fields (dates), and `onSubmit` gets the reason.
 */
function ActionForm({ label, danger, children, onSubmit, pending, error }: { label: string; danger?: boolean; children?: ReactNode; onSubmit: (reason: string) => void; pending: boolean; error: unknown }) {
  const [reason, setReason] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = AdminReasonSchema.safeParse(reason);
    if (!parsed.success) {
      setProblem(parsed.error.issues[0]?.message ?? "Add a short reason");
      return;
    }
    setProblem(null);
    onSubmit(parsed.data);
  };
  const shown = problem ?? (error ? errorText(error) : null);
  return (
    <form className="a-form" onSubmit={submit}>
      {children}
      <label className="a-field grow">
        <span>Reason (for the audit log)</span>
        <input className="a-in" value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} placeholder="Why are you doing this?" />
      </label>
      <button type="submit" className={danger ? "d-btn out" : "d-btn pri"} disabled={pending}>
        {pending ? "Saving…" : label}
      </button>
      {shown ? (
        <span className="a-err" role="alert">
          {shown}
        </span>
      ) : null}
    </form>
  );
}

/** "2026-10-28T09:30" for a datetime-local input, in UTC (packs open at UTC times). */
function toInput(iso: string): string {
  return iso.slice(0, 16);
}

function fromInput(v: string): string {
  return new Date(`${v}:00Z`).toISOString();
}

function utcText(iso: string): string {
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}

// ---------- Schedule ----------

function PackDates({ p }: { p: AdminPackRow }) {
  const [opens, setOpens] = useState(toInput(p.opensAt));
  const [ends, setEnds] = useState(toInput(p.endsAt));
  const save = useAdminWrite<PackDatesRequest>("PUT", `Pack ${p.number} dates saved.`);
  return (
    <ActionForm
      label="Save dates"
      pending={save.isPending}
      error={save.error}
      onSubmit={(reason) => save.mutate({ path: `/admin/packs/${p.number}/dates`, body: { opensAt: fromInput(opens), endsAt: fromInput(ends), reason } })}
    >
      <label className="a-field">
        <span>Opens (UTC)</span>
        <input className="a-in" type="datetime-local" value={opens} disabled={p.state === "live"} onChange={(e) => setOpens(e.target.value)} />
      </label>
      <label className="a-field">
        <span>Ends (UTC)</span>
        <input className="a-in" type="datetime-local" value={ends} onChange={(e) => setEnds(e.target.value)} />
      </label>
    </ActionForm>
  );
}

function Schedule() {
  const packs = useAdminPacks();
  const [open, setOpen] = useState<number | null>(null);
  if (packs.isError) return <ErrorState message={errorText(packs.error)} onRetry={() => void packs.refetch()} />;
  if (!packs.data) return <p className="a-note">Loading packs…</p>;
  return (
    <section className="d-card">
      <h3 className="d-ch">Battle Packs</h3>
      <p className="a-note">Upcoming packs can move. A live pack can only be extended. Finished packs are frozen.</p>
      <div className="a-table">
        {packs.data.map((p) => (
          <div key={p.number} className="a-item">
            <div className="a-line">
              <span className="grow a-meta">
                <b>
                  {p.number}. {p.title}
                </b>
                <span className={`a-tag a-${p.state}`}>{p.state}</span>
                <span className="a-dim">{p.belt}</span>
                <span className="a-dim">
                  {utcText(p.opensAt)} to {utcText(p.endsAt)}
                </span>
                <span className="a-dim">{p.players} players</span>
              </span>
              {p.state === "finished" ? null : (
                <button type="button" className="d-btn sec" onClick={() => setOpen(open === p.number ? null : p.number)} aria-expanded={open === p.number} aria-label={`Change dates for pack ${p.number}`}>
                  {open === p.number ? "Close" : "Change dates"}
                </button>
              )}
            </div>
            {open === p.number ? <PackDates p={p} /> : null}
          </div>
        ))}
      </div>
      <p className="a-note">
        Kata order comes from each kata&apos;s <code>kataDay</code> in git, so it changes by PR, not here.
      </p>
    </section>
  );
}

// ---------- Challenges ----------

function HideChallenge({ c }: { c: AdminChallengeRow }) {
  const save = useAdminWrite<AdminHideRequest>("POST", c.hidden ? `${c.title} is back.` : `${c.title} is hidden.`);
  return (
    <ActionForm
      label={c.hidden ? "Unhide" : "Hide"}
      danger={!c.hidden}
      pending={save.isPending}
      error={save.error}
      onSubmit={(reason) => save.mutate({ path: `/admin/challenges/${c.id}/hidden`, body: { hidden: !c.hidden, reason } })}
    />
  );
}

function Challenges() {
  const list = useAdminChallenges();
  const [open, setOpen] = useState<string | null>(null);
  if (list.isError) return <ErrorState message={errorText(list.error)} onRetry={() => void list.refetch()} />;
  if (!list.data) return <p className="a-note">Loading challenges…</p>;
  return (
    <section className="d-card">
      <h3 className="d-ch">Challenges</h3>
      <p className="a-note">Hiding pulls a broken challenge from play. Points already earned there stay. Fix it as a new challenge in git.</p>
      <div className="a-table">
        <div className="a-line a-head">
          <span className="a-c-num">#</span>
          <span className="grow">Title</span>
          <span className="a-c-n a-c-opt">Golden</span>
          <span className="a-c-n">Players</span>
          <span className="a-c-n">Pass 90+</span>
          <span className="a-c-n a-c-opt">Avg best</span>
          <span className="a-c-btn" />
        </div>
        {list.data.map((c) => (
          <div key={c.id} className="a-item">
            <div className="a-line">
              <span className="a-c-num a-dim">{c.number}</span>
              <span className="grow a-title">
                <Link to="/c/$id" params={{ id: c.id }} className="d-lnk">
                  {c.title}
                </Link>
                <span className="a-dim">
                  {c.kind === "kata" ? "kata" : c.packNumber ? `pack ${c.packNumber}` : "library"} · {c.belt}
                </span>
                {c.hidden ? <span className="a-tag a-hidden">hidden</span> : null}
              </span>
              <span className={`a-c-n a-c-opt${c.goldenAnswers < 3 ? " a-warn" : ""}`}>{c.goldenAnswers}</span>
              <span className="a-c-n">{c.players}</span>
              <span className="a-c-n">{Math.round(c.passRate * 100)}%</span>
              <span className="a-c-n a-c-opt">{c.avgBest ?? "–"}</span>
              <span className="a-c-btn">
                <button type="button" className="d-btn sec" onClick={() => setOpen(open === c.id ? null : c.id)} aria-expanded={open === c.id} aria-label={`${c.hidden ? "Unhide" : "Hide"} ${c.title}`}>
                  {open === c.id ? "Close" : c.hidden ? "Unhide" : "Hide"}
                </button>
              </span>
            </div>
            {open === c.id ? <HideChallenge c={c} /> : null}
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------- Players ----------

function PlayerActions({ p }: { p: AdminPlayerDetail }) {
  const [action, setAction] = useState<"hide" | "handle" | null>(null);
  const hide = useAdminWrite<AdminHideRequest>("POST", p.hidden ? "Player is back on the boards." : "Player is hidden from the boards.");
  const reset = useAdminWrite<AdminReasonOnlyRequest>("POST", "Handle reset.");
  return (
    <div className="a-actions">
      <div className="a-line">
        <button type="button" className="d-btn sec" aria-expanded={action === "hide"} onClick={() => setAction(action === "hide" ? null : "hide")}>
          {p.hidden ? "Show on boards" : "Hide from boards"}
        </button>
        {p.handle ? (
          <button type="button" className="d-btn sec" aria-expanded={action === "handle"} onClick={() => setAction(action === "handle" ? null : "handle")}>
            Reset handle
          </button>
        ) : null}
      </div>
      {action === "hide" ? (
        <ActionForm
          label={p.hidden ? "Show on boards" : "Hide"}
          danger={!p.hidden}
          pending={hide.isPending}
          error={hide.error}
          onSubmit={(reason) => hide.mutate({ path: `/admin/players/${p.playerId}/hidden`, body: { hidden: !p.hidden, reason } })}
        />
      ) : null}
      {action === "handle" ? (
        <ActionForm
          label="Reset handle"
          danger
          pending={reset.isPending}
          error={reset.error}
          onSubmit={(reason) => reset.mutate({ path: `/admin/players/${p.playerId}/reset-handle`, body: { reason } })}
        />
      ) : null}
    </div>
  );
}

function VoidSubmission({ id }: { id: string }) {
  const save = useAdminWrite<AdminReasonOnlyRequest>("POST", "Submission voided. Best score and belts recalculated.");
  return (
    <ActionForm label="Void" danger pending={save.isPending} error={save.error} onSubmit={(reason) => save.mutate({ path: `/admin/submissions/${id}/void`, body: { reason } })} />
  );
}

function PlayerDetail({ id }: { id: string }) {
  const p = useAdminPlayer(id);
  const [open, setOpen] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  if (p.isError) return <ErrorState message={errorText(p.error)} onRetry={() => void p.refetch()} />;
  if (!p.data) return <p className="a-note">Loading player…</p>;
  const d = p.data;
  return (
    <section className="d-card">
      <h3 className="d-ch">
        <span>{d.handle ? `@${d.handle}` : "Guest"}</span>
        {d.hidden ? <span className="a-tag a-hidden">hidden from boards</span> : null}
      </h3>
      <div className="a-kv">
        <span>Email</span>
        <b>{d.email ?? "–"}</b>
        <span>Points</span>
        <b>{d.points}</b>
        <span>Wall rank</span>
        <b>{d.wallRank ?? "–"}</b>
        <span>Solved</span>
        <b>{d.solved}</b>
        <span>Belts</span>
        <b>{d.belts.length ? d.belts.join(", ") : "none"}</b>
        <span>Joined</span>
        <b>{d.createdAt.slice(0, 10)}</b>
      </div>
      {d.handle ? (
        <p className="a-note">
          Public profile:{" "}
          <Link to="/u/$handle" params={{ handle: d.handle }} className="d-lnk">
            /u/{d.handle}
          </Link>
        </p>
      ) : null}
      <PlayerActions p={d} />
      <h4 className="a-sub">Last 50 Submits</h4>
      <div className="a-table">
        {d.submissions.length === 0 ? <p className="a-note">No Submits yet.</p> : null}
        {d.submissions.map((s) => (
          <div key={s.id} className="a-item">
            <div className="a-line">
              <span className="a-dim">{utcText(s.createdAt)}</span>
              <span className="grow">{s.challengeId}</span>
              <span className="a-dim">{s.board}</span>
              <span className="a-c-n">{s.score === null ? s.status : s.score.toFixed(1)}</span>
              {s.voided ? <span className="a-tag a-hidden">voided</span> : null}
              <button type="button" className="d-btn sec" aria-expanded={code === s.id} aria-label={`Code of the ${s.challengeId} Submit at ${utcText(s.createdAt)}`} onClick={() => setCode(code === s.id ? null : s.id)}>
                Code
              </button>
              {s.voided ? null : (
                <button type="button" className="d-btn sec" aria-expanded={open === s.id} aria-label={`Void the ${s.challengeId} Submit at ${utcText(s.createdAt)}`} onClick={() => setOpen(open === s.id ? null : s.id)}>
                  Void
                </button>
              )}
            </div>
            {code === s.id ? <pre className="a-code">{s.code}</pre> : null}
            {open === s.id ? <VoidSubmission id={s.id} /> : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function Players() {
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const found = useAdminPlayerSearch(q);
  return (
    <>
      <section className="d-card">
        <h3 className="d-ch">Find a player</h3>
        <label className="a-field">
          <span>Handle, name or email</span>
          <input className="a-in" value={q} onChange={(e) => setQ(e.target.value)} placeholder="At least 2 letters" />
        </label>
        <div className="a-table">
          {found.isError ? <p className="a-err">{errorText(found.error)}</p> : null}
          {found.data?.length === 0 ? <p className="a-note">Nobody matches.</p> : null}
          {found.data?.map((r) => (
            <button type="button" key={r.playerId} className={`a-line a-pick${picked === r.playerId ? " on" : ""}`} onClick={() => setPicked(r.playerId)}>
              <b>{r.handle ? `@${r.handle}` : r.name}</b>
              <span className="a-dim grow">{r.email}</span>
              <span className="a-c-n">{r.points} pts</span>
              <span className="a-c-n">{r.solved} solved</span>
              {r.hidden ? <span className="a-tag a-hidden">hidden</span> : null}
            </button>
          ))}
        </div>
      </section>
      {picked ? <PlayerDetail key={picked} id={picked} /> : null}
    </>
  );
}

// ---------- Health ----------

function Stat({ label, value, warn }: { label: string; value: ReactNode; warn?: boolean }) {
  return (
    <div className={`a-stat${warn ? " a-warn" : ""}`}>
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

function Health() {
  const stats = useAdminStats();
  if (stats.isError) return <ErrorState message={errorText(stats.error)} onRetry={() => void stats.refetch()} />;
  if (!stats.data) return <p className="a-note">Loading stats…</p>;
  const { today, days, scorer } = stats.data;
  const peak = Math.max(1, ...days.map((d) => d.submits));
  return (
    <>
      <section className="d-card">
        <h3 className="d-ch">Today (UTC)</h3>
        <div className="a-stats">
          <Stat label="Sign-ups" value={today.signups} />
          <Stat label="Active players" value={today.activePlayers} />
          <Stat label="Submits" value={today.submits} />
          <Stat label="Solves (90+)" value={today.solves} />
        </div>
      </section>
      <section className="d-card">
        <h3 className="d-ch">Scorer</h3>
        <div className="a-stats">
          <Stat label="Waiting" value={scorer.queued} warn={scorer.queued > 20} />
          <Stat label="Oldest waiting" value={scorer.oldestQueuedSec === null ? "–" : `${scorer.oldestQueuedSec}s`} warn={(scorer.oldestQueuedSec ?? 0) > 60} />
          <Stat label="Failed (24h)" value={scorer.failedLastDay} warn={scorer.failedLastDay > 0} />
          <Stat label="Avg time to score (24h)" value={scorer.avgScoreSec === null ? "–" : `${scorer.avgScoreSec}s`} />
        </div>
      </section>
      <section className="d-card">
        <h3 className="d-ch">Last 30 days</h3>
        <div className="a-days" role="table" aria-label="Last 30 days">
          <div className="a-line a-head" role="row">
            <span role="columnheader">Day</span>
            <span role="columnheader" className="a-c-n">
              Sign-ups
            </span>
            <span role="columnheader" className="a-c-n">
              Active
            </span>
            <span role="columnheader" className="a-c-n">
              Submits
            </span>
            <span role="columnheader" className="grow" />
          </div>
          {[...days].reverse().map((d) => (
            <div key={d.date} className="a-line" role="row">
              <span role="cell" className="a-dim">
                {d.date}
              </span>
              <span role="cell" className="a-c-n">
                {d.signups}
              </span>
              <span role="cell" className="a-c-n">
                {d.activePlayers}
              </span>
              <span role="cell" className="a-c-n">
                {d.submits}
              </span>
              <span role="cell" className="grow">
                <i className="a-bar" style={{ width: `${(d.submits / peak) * 100}%` }} />
              </span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

// ---------- Audit log ----------

function short(v: unknown): string {
  return v === null || v === undefined ? "–" : JSON.stringify(v);
}

function Log() {
  const rows = useAdminActions();
  if (rows.isError) return <ErrorState message={errorText(rows.error)} onRetry={() => void rows.refetch()} />;
  if (!rows.data) return <p className="a-note">Loading the log…</p>;
  if (rows.data.length === 0) return <EmptyState title="No admin actions yet">Every change made here shows up in this list.</EmptyState>;
  return (
    <section className="d-card">
      <h3 className="d-ch">Last 100 actions</h3>
      <div className="a-table">
        {rows.data.map((r) => (
          <div key={r.id} className="a-item">
            <div className="a-line">
              <span className="a-dim">{utcText(r.at)}</span>
              <b>{r.action}</b>
              <span className="a-dim">{r.target}</span>
              <span className="grow">{r.reason}</span>
              <span className="a-dim">@{r.admin}</span>
            </div>
            <div className="a-line a-diff">
              <code>{short(r.before)}</code>
              <span aria-hidden="true">→</span>
              <code>{short(r.after)}</code>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------- Page ----------

export function Admin({ tab }: { tab: AdminTab }) {
  const me = useMe();
  const signedIn = !!me.data?.user;
  const admin = useIsAdmin(signedIn);
  const tabs = (
    <GlideTabs>
      {ADMIN_TABS.map((t) => (
        <Link key={t} to="/admin" search={{ tab: t }} role="tab" aria-selected={tab === t}>
          {TAB_LABEL[t]}
        </Link>
      ))}
    </GlideTabs>
  );
  if (me.isLoading || (signedIn && admin.isLoading)) return <Page kicker="Admin" title="Admin">{null}</Page>;
  // Non-admins get the same page as any unknown address.
  if (!signedIn || !admin.data) {
    return (
      <Page kicker="Admin" title="Not found">
        <EmptyState title="Nothing here" action={<Link to="/" className="d-btn sec">Go home</Link>}>
          This page does not exist.
        </EmptyState>
      </Page>
    );
  }
  return (
    <Page kicker="Admin" title={TAB_LABEL[tab]} tabs={tabs}>
      <div className="a-col">
        {tab === "schedule" ? <Schedule /> : null}
        {tab === "challenges" ? <Challenges /> : null}
        {tab === "players" ? <Players /> : null}
        {tab === "health" ? <Health /> : null}
        {tab === "log" ? <Log /> : null}
      </div>
    </Page>
  );
}
