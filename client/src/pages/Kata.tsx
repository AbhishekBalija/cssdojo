import { useQuery } from "@tanstack/react-query";
import type { KataToday } from "@cssdojo/shared";
import { Header } from "@/components/Header";
import { api } from "@/lib/api";
import { Play } from "./Play";

/** Today's kata: the same play screen, scored on today's board (closes at 00:00 UTC). */
export function Kata() {
  const q = useQuery({ queryKey: ["kata-today"], queryFn: () => api<KataToday>("/kata/today"), staleTime: 60_000 });
  if (!q.data) {
    return (
      <div className="app">
        <Header />
        <div className="empty-state">{q.isError ? <h2>No kata today</h2> : <p>Loading today's kata…</p>}</div>
      </div>
    );
  }
  const d = new Date(`${q.data.date}T00:00:00Z`);
  const label = `day ${q.data.day} · ${d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })}`;
  return <Play key={q.data.date} challengeId={q.data.challengeId} board={`kata:${q.data.date}`} kataLabel={label} />;
}
