import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { SOLVED_AT, type ChallengeSummary, type KataMonth, type KataToday } from "@cssdojo/shared";
import { api, staticUrl } from "@/lib/api";
import { monthKey, shortDate, useKataMonth } from "@/lib/dojo";
import { Countdown, Hang, I } from "./Craft";

// Yesterday, today (hanging from the lit rod) and tomorrow's locked tile.
// Used on Home and on the Daily kata page.

export function useKataToday() {
  return useQuery({ queryKey: ["kata-today"], queryFn: () => api<KataToday>("/kata/today"), staleTime: 60_000 });
}

export function useChallenges() {
  return useQuery({ queryKey: ["challenges"], queryFn: () => api<ChallengeSummary[]>("/challenges"), staleTime: 60_000 });
}

/** "FRI 6 NOV" for a YYYY-MM-DD date (UTC). */
export function dayLabel(date: string, withDow = true): string {
  const d = new Date(`${date}T00:00:00Z`);
  const dm = shortDate(`${date}T00:00:00Z`);
  return (withDow ? `${d.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" })} ${dm}` : dm).toUpperCase();
}

export function scoreClass(s: number | null | undefined): string {
  if (s === null || s === undefined) return "sc-new";
  return s >= SOLVED_AT ? "sc-ok" : "sc-mid";
}

function addDays(date: string, n: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}

/** Finds a day in this month's or last month's calendar. */
function findDay(months: (KataMonth | null | undefined)[], date: string) {
  for (const m of months) {
    const d = m?.days.find((x) => x.date === date);
    if (d) return d;
  }
  return undefined;
}

export function KataStage() {
  const today = useKataToday();
  const list = useChallenges();
  const date = today.data?.date ?? new Date().toISOString().slice(0, 10);
  const yDate = addDays(date, -1);
  const thisMonth = useKataMonth(date.slice(0, 7));
  const lastMonth = useKataMonth(monthKey(new Date(`${yDate}T00:00:00Z`)));
  if (!today.data) {
    return (
      <section className="d-card" style={{ padding: "40px 32px", alignItems: "center" }}>
        <p className="note">{today.isError ? "No kata today. Try a Battle Pack instead." : "Loading today's kata…"}</p>
      </section>
    );
  }
  const k = today.data;
  const t = list.data?.find((c) => c.id === k.challengeId);
  const tDay = findDay([thisMonth.data], date);
  const y = findDay([thisMonth.data, lastMonth.data], yDate);
  const myScore = tDay?.myScore ?? null;
  const tomorrow = thisMonth.data?.tomorrowOpensAt ?? k.resetsAt;
  return (
    <section className="d-card" style={{ padding: "40px 32px 32px", alignItems: "center", overflow: "hidden" }}>
      <div className="d-stage">
        {y ? (
          <div className="col">
            <span className="d-chip">{dayLabel(yDate)}</span>
            <Link to="/c/$id" params={{ id: y.challengeId }} className="d-tile" style={{ width: 216, padding: "6px 6px 0" }}>
              <img src={staticUrl(`/targets/${y.challengeId}/thumb.png`)} alt={`Yesterday: ${y.title}`} />
              <span className="foot">
                <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <span className="k">{y.myScore === null ? y.title : "Your score"}</span>
                  <span className={`d-mono ${scoreClass(y.myScore)}`} style={{ fontSize: 15 }}>
                    {y.myScore === null ? "Missed" : y.myScore.toFixed(1)}
                  </span>
                </span>
                <span className="d-lnk" style={{ fontSize: 12 }}>
                  Practice
                </span>
              </span>
            </Link>
          </div>
        ) : null}
        <div className="col">
          <span className="d-chip new">{dayLabel(date)} · TODAY</span>
          <Hang>
            <Link to="/kata/play" className="d-tile today" style={{ width: 300, padding: "7px 7px 0" }}>
              <img src={staticUrl(`/targets/${k.challengeId}/thumb.png`)} alt={`Today: ${t?.title ?? "today's kata"}`} style={{ background: t?.background }} />
              <span className="foot" style={{ alignItems: "center", paddingBottom: 12 }}>
                <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <span className="k">{t?.title ?? "Today's kata"}</span>
                  <span className={`d-mono ${myScore === null ? "" : scoreClass(myScore)}`} style={{ fontSize: 15, color: myScore === null ? "var(--accent)" : undefined }}>
                    {myScore === null ? (tDay?.attempted ? "Tried" : "Not played") : myScore.toFixed(1)}
                  </span>
                </span>
                <span className="d-btn pri d-playbtn" aria-hidden="true">
                  {I.play}
                </span>
              </span>
            </Link>
          </Hang>
        </div>
        <div className="col">
          <span className="d-chip">TOMORROW</span>
          <div className="d-tile" style={{ width: 216, padding: "6px 6px 0" }}>
            <div className="ph closed">{I.lock}</div>
            <span style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "12px 6px" }}>
              <span className="k" style={{ font: "400 11px/14px var(--font-ui)", color: "var(--sub)" }}>
                Opens in
              </span>
              <Countdown to={tomorrow} />
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
