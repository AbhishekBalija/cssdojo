import { BADGES, type BadgeDef, type NotificationView } from "@cssdojo/shared";

// Rendered badge objects (docs/design/rendered-assets.md, "Achievement badges"). Each badge is a
// real object from the Blender studio, cut into the layers its motion moves, stacked in order:
// belt knot (band + knot, then each tail, which sways), sealed scroll (scroll, then the seal) and
// the streak lantern (lit, with a dim copy on top that flickers in and out; unlit when locked).
// Badges without art yet return null, so the caller keeps its icon medal.

const BELT_IDS = new Set(["belt-white", "belt-yellow", "belt-green", "belt-brown", "belt-black"]);
const LANTERN_IDS: Record<string, string> = { "streak-3": "3", "streak-7": "7", "streak-30": "30" };

function Layer({ src, className }: { src: string; className?: string }) {
  return <img className={className} src={`${src}@1x.webp`} srcSet={`${src}@2x.webp 2x, ${src}@3x.webp 3x`} alt="" draggable={false} />;
}

export function hasBadgeArt(id: string): boolean {
  return BELT_IDS.has(id) || id === "pack-cleared" || id in LANTERN_IDS;
}

/** The badge a "badge" or "belt" notification is about. Notifications carry no badge id, but
 *  their titles always hold the badge's name ("Badge earned: 7 days", "White belt earned"). */
export function badgeForNote(n: Pick<NotificationView, "kind" | "title">): BadgeDef | undefined {
  if (n.kind !== "badge" && n.kind !== "belt") return undefined;
  const name = n.kind === "badge" ? n.title.replace(/^Badge earned: /, "") : n.title.replace(/ earned$/, "");
  return BADGES.find((b) => b.name === name);
}

/** `fresh` plays the earn moment once (for toasts): the seal stamps on, the lantern lights up. */
export function BadgeArt({ b, earned, size = 64, fresh = false }: { b: BadgeDef; earned: boolean; size?: number; fresh?: boolean }) {
  const state = `${earned ? "on" : "off"}${fresh ? " fresh" : ""}`;
  const style = { width: size, height: size };
  if (BELT_IDS.has(b.id)) {
    const base = `/art/badge-belt/${b.id.slice(5)}`;
    return (
      <span className={`d-bart b-belt ${state}`} style={style} aria-hidden="true">
        <Layer src={`${base}-belt`} />
        <Layer src={`${base}-tail-l`} className="tl" />
        <Layer src={`${base}-tail-r`} className="tr" />
      </span>
    );
  }
  if (b.id === "pack-cleared") {
    return (
      <span className={`d-bart b-scroll ${state}`} style={style} aria-hidden="true">
        <Layer src="/art/badge-scroll/scroll" />
        {earned ? <Layer src="/art/badge-scroll/seal" className="seal" /> : null}
      </span>
    );
  }
  const n = LANTERN_IDS[b.id];
  if (n) {
    const base = `/art/badge-lantern/${n}`;
    return (
      <span className={`d-bart b-lantern ${state}`} style={style} aria-hidden="true">
        <span className="sway">
          {fresh ? <Layer src={`${base}-unlit`} /> : null}
          <Layer src={earned ? `${base}-lit` : `${base}-unlit`} className={fresh ? "lit" : undefined} />
          {earned ? <Layer src={`${base}-dim`} className="dim" /> : null}
        </span>
      </span>
    );
  }
  return null;
}
