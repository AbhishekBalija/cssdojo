import { Link } from "@tanstack/react-router";
import { Page, I } from "@/components/Craft";
import { dayLabel, KataStage, useKataToday } from "@/components/KataStage";
import { PackCard } from "@/components/PackCard";
import { usePacks } from "@/lib/dojo";

/** Home: today's kata hanging on the lit rod, then the latest Battle Pack. */
export function Home() {
  const today = useKataToday();
  const packs = usePacks();
  const latest = packs.data?.find((p) => p.state === "live") ?? packs.data?.find((p) => p.state === "finished");
  return (
    <Page kicker={today.data ? dayLabel(today.data.date) : "Today"} title="Today’s kata">
      <KataStage />
      {latest ? (
        <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <h3 className="d-ch bare">
            {I.grid}
            <span>Latest Battle Pack</span>
            <span className="sp" />
            <Link to="/packs">All Battle Packs {I.arrow}</Link>
          </h3>
          <PackCard p={latest} />
        </section>
      ) : null}
    </Page>
  );
}
