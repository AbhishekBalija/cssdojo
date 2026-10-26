import { Link, useNavigate } from "@tanstack/react-router";
import type { ChallengeSummary, PackSummary, PublicChallenge } from "@cssdojo/shared";
import { useEffect, useState } from "react";
import { pad3 } from "@/lib/belts";
import { packName, usePacks } from "@/lib/dojo";
import { useGuestMerge } from "@/lib/me";
import { useChallenges } from "./KataStage";
import { BeltChip } from "./Craft";
import { Sidebar } from "./Shell";

// The play screen's slim header: menu, where this target lives, its belt and
// title (a picker), and Prev / Next inside its Battle Pack.

/** The Battle Pack a challenge belongs to, if any. */
export function usePackOf(challengeId: string): PackSummary | undefined {
  const packs = usePacks();
  return packs.data?.find((p) => p.challenges.some((c) => c.id === challengeId));
}

export function PlayHeader({ c, challengeId, kataLabel }: { c: PublicChallenge | undefined; challengeId: string; kataLabel?: string }) {
  useGuestMerge();
  const navigate = useNavigate();
  const list = useChallenges();
  const pack = usePackOf(challengeId);
  const [nav, setNav] = useState(false);
  const [pick, setPick] = useState(false);

  useEffect(() => {
    if (!pick && !nav) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPick(false);
        setNav(false);
      }
    };
    const onClick = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest(".d-pick, [data-pick]")) setPick(false);
    };
    addEventListener("keydown", onKey);
    document.addEventListener("click", onClick);
    return () => {
      removeEventListener("keydown", onKey);
      document.removeEventListener("click", onClick);
    };
  }, [pick, nav]);

  const siblings: { id: string; number: number; title: string; best: number | null; background: string }[] = pack
    ? pack.challenges
    : (list.data ?? []).filter((x: ChallengeSummary) => x.kind === "challenge" || x.id === challengeId);
  const at = siblings.findIndex((x) => x.id === challengeId);
  const prev = at > 0 ? siblings[at - 1] : undefined;
  const next = at >= 0 && at < siblings.length - 1 ? siblings[at + 1] : undefined;

  return (
    <header className="d-playhead">
      <button type="button" className="d-round" aria-label="Menu" aria-expanded={nav} onClick={() => setNav(true)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>
      <nav className="crumb" aria-label="Where this target lives">
        {kataLabel ? (
          <Link to="/kata" className="where">
            Daily kata · {kataLabel}
          </Link>
        ) : pack ? (
          <Link to="/packs/$n" params={{ n: String(pack.number) }} className="where">
            {packName(pack.number)} · {pack.title}
          </Link>
        ) : (
          <Link to="/packs" className="where">
            Battle Packs
          </Link>
        )}
        {c ? <BeltChip belt={c.belt} /> : null}
        <span className="d-pickwrap">
          <button type="button" className="d-pick" aria-haspopup="true" aria-expanded={pick} onClick={() => setPick(!pick)} data-pick>
            {c ? `${pad3(c.number)} ${c.title}` : "Loading"}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          {pick ? (
            <span className="d-pickpop" role="menu">
              <span className="h">{pack ? packName(pack.number) : "Challenges"}</span>
              <span className="l">
                {siblings.map((x) => (
                  <button
                    key={x.id}
                    type="button"
                    role="menuitem"
                    aria-current={x.id === challengeId}
                    onClick={() => {
                      setPick(false);
                      void navigate({ to: "/c/$id", params: { id: x.id } });
                    }}
                  >
                    <i style={{ background: x.background }} />
                    <span className="t">
                      {pad3(x.number)} {x.title}
                    </span>
                    <span className="d-mono s">{x.best ?? "–"}</span>
                  </button>
                ))}
              </span>
            </span>
          ) : null}
        </span>
      </nav>
      {!kataLabel ? (
        <span className="pn">
          {prev ? (
            <Link to="/c/$id" params={{ id: prev.id }} title={`${pad3(prev.number)} ${prev.title}`}>
              Prev ←
            </Link>
          ) : (
            <span className="off">Prev ←</span>
          )}
          <i>·</i>
          {next ? (
            <Link to="/c/$id" params={{ id: next.id }} title={`${pad3(next.number)} ${next.title}`}>
              → Next
            </Link>
          ) : (
            <span className="off">→ Next</span>
          )}
        </span>
      ) : null}
      <div className={`d-playnav${nav ? " open" : ""}`} onClick={(e) => e.target === e.currentTarget && setNav(false)}>
        {nav ? <Sidebar onNavigate={() => setNav(false)} /> : null}
      </div>
    </header>
  );
}
