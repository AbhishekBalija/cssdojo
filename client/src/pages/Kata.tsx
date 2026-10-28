import { useQuery } from "@tanstack/react-query";
import type { KataToday } from "@cssdojo/shared";
import { dayLabel } from "@/components/KataStage";
import { EmptyState, StatePage } from "@/components/States";
import { api } from "@/lib/api";
import { Play } from "./Play";

export function Kata() {
  const q = useQuery({ queryKey: ["kata-today"], queryFn: () => api<KataToday>("/kata/today"), staleTime: 60_000 });
  if (!q.data) {
    return <StatePage>{q.isError ? <EmptyState title="No kata today">Try a Battle Pack instead.</EmptyState> : null}</StatePage>;
  }
  return <Play key={q.data.date} challengeId={q.data.challengeId} board={`kata:${q.data.date}`} kataLabel={dayLabel(q.data.date)} />;
}
