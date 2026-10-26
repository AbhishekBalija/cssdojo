import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { ChallengeProgress, PublicChallenge, SolutionsView } from "@cssdojo/shared";
import { useState } from "react";
import { I, Page } from "@/components/Craft";
import { usePackOf } from "@/components/PlayHeader";
import { ErrorState } from "@/components/States";
import { api, ApiError } from "@/lib/api";
import { pad3 } from "@/lib/belts";
import { packName, useSolutions } from "@/lib/dojo";
import { toast } from "@/lib/toast";
import { Avatar } from "./Leaderboards";

// Solutions for one target: a confirm step first, because opening them locks
// your points on it (docs/requirements/ranking.md).

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  const copy = () => {
    void navigator.clipboard?.writeText(text).then(
      () => {
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      },
      () => toast("Couldn't copy here"),
    );
  };
  return (
    <button type="button" className={`d-copy${done ? " done" : ""}`} onClick={copy} aria-label={done ? "Copied" : "Copy code"}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {done ? (
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        ) : (
          <>
            <rect x="8" y="8" width="12" height="12" rx="2" />
            <path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" />
          </>
        )}
      </svg>
      {done ? "Copied" : "Copy"}
    </button>
  );
}

function Code({ code }: { code: string }) {
  const [open, setOpen] = useState(false);
  const lines = code.split("\n").length;
  return (
    <div className={`d-code${open || lines <= 14 ? " open" : ""}`}>
      <pre>{code}</pre>
      {lines > 14 ? (
        <button type="button" className="more" onClick={() => setOpen(!open)}>
          {open ? "Show less" : `Show all ${lines} lines`}
        </button>
      ) : null}
    </div>
  );
}

function Confirm({ id, c, progress }: { id: string; c: PublicChallenge; progress: ChallengeProgress | undefined }) {
  const qc = useQueryClient();
  const open = useMutation({
    mutationFn: () => api<SolutionsView>(`/challenges/${id}/solutions/open`, { method: "POST" }),
    onSuccess: (v) => {
      qc.setQueryData(["solutions", id], v);
      void qc.invalidateQueries({ queryKey: ["progress", id] });
    },
    onError: (e) => toast(e instanceof ApiError ? e.message : "Could not open solutions. Try again."),
  });
  const best = progress?.best ?? null;
  return (
    <div className="d-solgate">
      <div className="ghost" aria-hidden="true">
        {Array.from({ length: 5 }, (_, i) => (
          <span key={i} />
        ))}
      </div>
      <section className="d-card d-lockcard" role="dialog" aria-labelledby="lock-h">
        <span className="ic">{I.lock}</span>
        <h2 id="lock-h">Opening solutions locks your points here</h2>
        <p>
          {best !== null ? (
            <>
              Your best on {pad3(c.number)} stays at <b className="d-mono">{best.toFixed(1)}</b>, which is {progress?.points ?? 0} points. You can keep playing it, but new scores won't count for points or rank.
            </>
          ) : (
            <>You have no score on {pad3(c.number)} yet, so it will give you no points. You can keep playing it for practice.</>
          )}
        </p>
        <div className="acts">
          <Link to="/c/$id" params={{ id }} className="d-btn pri grow">
            Keep trying
          </Link>
          <button type="button" className="d-btn out" disabled={open.isPending} onClick={() => open.mutate()}>
            {open.isPending ? "Opening…" : "Open solutions"}
          </button>
        </div>
      </section>
    </div>
  );
}

export function Solutions({ id }: { id: string }) {
  const ch = useQuery({ queryKey: ["challenge", id], queryFn: () => api<PublicChallenge>(`/challenges/${id}`) });
  const progress = useQuery({ queryKey: ["progress", id], queryFn: () => api<ChallengeProgress>(`/challenges/${id}/progress`) });
  const sol = useSolutions(id);
  const pack = usePackOf(id);
  const c = ch.data;
  if (ch.isError) {
    return (
      <div className="d-pg">
        <ErrorState title="That challenge isn't here" message="It may have been renamed." />
      </div>
    );
  }
  if (!c) return <div className="d-pg" />;
  const v = sol.data;
  return (
    <Page
      kicker={
        <>
          {pad3(c.number)} {c.title}
        </>
      }
      title="Solutions"
      sub="The top five for this target. Ties go to whoever got there first."
      right={
        v?.locked ? (
          <span className="d-chip" title="Opening solutions froze your points here">
            {I.lock} LOCKED{v.frozen ? ` AT ${v.frozen.score.toFixed(1)} · ${v.frozen.points} PTS` : ""}
          </span>
        ) : null
      }
      tabs={
        <nav className="d-crumbs" aria-label="Breadcrumb" style={{ order: -1, marginBottom: 14 }}>
          {pack ? <Link to="/packs/$n" params={{ n: String(pack.number) }}>{packName(pack.number)}</Link> : <Link to="/packs">Battle Packs</Link>}
          <span aria-hidden="true">›</span>
          <Link to="/c/$id" params={{ id }}>
            {pad3(c.number)} {c.title}
          </Link>
          <span aria-hidden="true">›</span>
          <b>Solutions</b>
        </nav>
      }
    >
      {sol.isError ? <ErrorState message="Solutions did not load." onRetry={() => void sol.refetch()} /> : null}
      {v && !v.locked ? <Confirm id={id} c={c} progress={progress.data} /> : null}
      {v?.locked ? (
        <>
          {v.top.length ? (
            <div className="d-sols">
              {v.top.map((s) => (
                <section key={s.rank} className="d-card d-sol">
                  <div className="hd">
                    <span className="d-mono rk">{s.rank}</span>
                    <Link to="/u/$handle" params={{ handle: s.player.handle }} className="who">
                      <Avatar p={s.player} />
                      {s.player.handle}
                    </Link>
                    <span className="sp" />
                    <span className="d-mono sc">{s.score.toFixed(1)}</span>
                    <span className="d-mono ch">{s.chars} chars</span>
                    <CopyButton text={s.code} />
                  </div>
                  <Code code={s.code} />
                </section>
              ))}
            </div>
          ) : (
            <p className="note">No scored answers yet. Ours is below.</p>
          )}
          {v.reference ? (
            <section className="d-card d-sol">
              <div className="hd">
                <span className="who">Our reference</span>
                <span className="sp" />
                <span className="d-mono ch">{v.reference.length} chars</span>
                <CopyButton text={v.reference} />
              </div>
              <p className="note" style={{ margin: 0 }}>
                One way to build it. Yours may be just as good.
              </p>
              <Code code={v.reference} />
            </section>
          ) : null}
        </>
      ) : null}
    </Page>
  );
}
