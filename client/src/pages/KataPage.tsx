import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { CLOTH, I, Page } from "@/components/Craft";
import { KataStage, scoreClass, useChallenges, useKataToday } from "@/components/KataStage";
import { staticUrl } from "@/lib/api";
import { useKataMonth } from "@/lib/dojo";

const DOWS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

function shiftMonth(m: string, by: number): string {
  const [y, mo] = m.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(y, mo - 1 + by, 1));
  return d.toISOString().slice(0, 7);
}

/** Daily kata: today's stage, then a month calendar of past kata and your scores. */
export function KataPage() {
  const today = useKataToday();
  const todayDate = today.data?.date ?? new Date().toISOString().slice(0, 10);
  const thisMonth = todayDate.slice(0, 7);
  const [month, setMonth] = useState(thisMonth);
  const cal = useKataMonth(month);
  const list = useChallenges();
  const beltOf = (id: string) => list.data?.find((c) => c.id === id)?.belt;
  const [y, mo] = month.split("-").map(Number) as [number, number];
  const first = new Date(Date.UTC(y, mo - 1, 1));
  const daysIn = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const lead = first.getUTCDay();
  const cells: (number | null)[] = [...Array<null>(lead).fill(null), ...Array.from({ length: daysIn }, (_, i) => i + 1)];
  const byDate = new Map((cal.data?.days ?? []).map((d) => [d.date, d]));
  const past = (cal.data?.days ?? []).filter((d) => d.date <= todayDate);
  const played = past.filter((d) => d.attempted || d.myScore !== null).length;
  const title = first.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
  return (
    <Page kicker="Daily kata" title="Daily kata" sub="One small component a day, the same for everyone. Submit an attempt by 00:00 UTC to keep your streak. Any score counts.">
      <KataStage />
      <section className="d-card">
        <h3 className="d-ch">
          {I.cal}
          <span>{title}</span>
          <button type="button" className="d-round" style={{ width: 30, height: 30 }} aria-label="Previous month" onClick={() => setMonth(shiftMonth(month, -1))}>
            ‹
          </button>
          <button type="button" className="d-round" style={{ width: 30, height: 30 }} aria-label="Next month" disabled={month >= thisMonth} onClick={() => setMonth(shiftMonth(month, 1))}>
            ›
          </button>
          <span className="sp" />
          {cal.data ? (
            <span className="meta">
              {played} of {past.length} played
            </span>
          ) : null}
        </h3>
        <div className="d-cal">
          {DOWS.map((d) => (
            <span key={d} className="dow">
              {d}
            </span>
          ))}
          {cells.map((n, i) => {
            if (n === null) return <span key={`b${i}`} className="day blank" />;
            const date = `${month}-${String(n).padStart(2, "0")}`;
            const k = byDate.get(date);
            const isToday = date === todayDate;
            const label = `${first.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" }).toUpperCase()} ${n}`;
            if (!k || date > todayDate) {
              return (
                <span key={date} className="day">
                  <span className="dt" style={{ alignSelf: "flex-end", background: "none" }}>
                    {label}
                  </span>
                </span>
              );
            }
            const belt = beltOf(k.challengeId);
            return (
              <Link key={date} to={isToday ? "/kata/play" : "/c/$id"} params={isToday ? undefined : { id: k.challengeId }} className={`day has${isToday ? " today" : ""}`} title={k.title}>
                <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  {belt ? <span className="d-tk" style={{ background: CLOTH[belt].acc }} /> : <span />}
                  <span className="dt">{label}</span>
                </span>
                <img src={staticUrl(`/targets/${k.challengeId}/thumb.png`)} alt={k.title} loading="lazy" />
                <span className={`sc ${isToday && k.myScore === null ? "" : scoreClass(k.myScore)}`}>{k.myScore !== null ? k.myScore.toFixed(1) : isToday ? "Today" : k.attempted ? "Tried" : "Missed"}</span>
              </Link>
            );
          })}
        </div>
      </section>
    </Page>
  );
}
