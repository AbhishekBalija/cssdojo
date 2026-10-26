import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { SOLVED_AT, type PackSummary } from "@cssdojo/shared";
import { useState } from "react";
import { GlideTabs, I, Page } from "@/components/Craft";
import { avatarColor, PackCard, UpcomingPack } from "@/components/PackCard";
import { EmptyState } from "@/components/States";
import { api } from "@/lib/api";
import { usePacks, useWall } from "@/lib/dojo";
import { toast } from "@/lib/toast";

type Filter = "all" | "progress" | "done";

function allSolved(p: PackSummary): boolean {
  return p.challenges.length > 0 && p.challenges.every((c) => c.best !== null && c.best >= SOLVED_AT);
}

/** Small all-time leaders card beside the packs. */
function LeadersAside() {
  const wall = useWall(1);
  if (!wall.data) return null;
  const top = wall.data.rows.slice(0, 5);
  const me = wall.data.me && !top.some((r) => r.me) ? wall.data.me : null;
  return (
    <aside className="d-card" style={{ gap: 10, padding: "16px 14px" }}>
      <h3 className="d-ch" style={{ paddingBottom: 10 }}>
        {I.trophy}
        <span>All-time leaders</span>
      </h3>
      <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 2 }}>
        {[...top, ...(me ? [me] : [])].map((r) => (
          <li key={r.player.handle} className={`d-mini${r.me ? " me" : ""}`}>
            <span className="rn" style={{ color: r.rank <= 3 ? "var(--warn)" : undefined }}>
              {r.rank}
            </span>
            <span className="av" style={{ background: r.me ? "var(--line-strong)" : avatarColor(r.player.handle) }} />
            <Link to="/u/$handle" params={{ handle: r.player.handle }} className="nm">
              {r.player.handle}
            </Link>
            <span className="pt">{r.points.toLocaleString("en-US")}</span>
          </li>
        ))}
      </ol>
      <Link to="/leaderboard" className="d-lnk" style={{ margin: "4px 8px" }}>
        The Wall {I.arrow}
      </Link>
    </aside>
  );
}

export function Packs() {
  const packs = usePacks();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>("all");
  const list = packs.data ?? [];
  const upcoming = list.filter((p) => p.state === "upcoming");
  const open = list.filter((p) => p.state !== "upcoming").filter((p) => (filter === "all" ? true : filter === "done" ? allSolved(p) : !allSolved(p) && (p.me?.tried ?? 0) + (p.me?.solved ?? 0) > 0));
  const notify = async (n: number, on: boolean) => {
    try {
      await api(`/packs/${n}/notify`, { method: "POST", json: { on } });
      toast(on ? "We'll tell you when it opens." : "Okay, no reminder.");
      void qc.invalidateQueries({ queryKey: ["packs"] });
    } catch {
      toast("Sign in to get a reminder.");
    }
  };
  const tabs: [Filter, string][] = [
    ["all", "All"],
    ["progress", "In progress"],
    ["done", "Completed"],
  ];
  return (
    <Page
      kicker="Battle Packs"
      title="Battle Packs"
      sub="New packs drop any time. Each is one belt: solve 5 of its 6 to earn it."
      tabs={
        <GlideTabs>
          {tabs.map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={filter === k} onClick={() => setFilter(k)}>
              {l}
            </button>
          ))}
        </GlideTabs>
      }
    >
      <div className="d-packs">
        <div style={{ display: "flex", flexDirection: "column", gap: 24, minWidth: 0 }}>
          {filter === "all" ? upcoming.map((p) => <UpcomingPack key={p.number} p={p} onNotify={(on) => void notify(p.number, on)} />) : null}
          {open.map((p) => (
            <PackCard key={p.number} p={p} />
          ))}
          {packs.isLoading ? <p className="note d-wait">Loading packs…</p> : null}
          {packs.data === null ? <EmptyState title="Battle Packs are on their way">The first pack opens soon. Today's kata is ready now.</EmptyState> : null}
          {packs.data && !open.length && filter !== "all" ? <EmptyState title={filter === "done" ? "No pack fully solved yet" : "No pack started yet"} /> : null}
        </div>
        <LeadersAside />
      </div>
    </Page>
  );
}
