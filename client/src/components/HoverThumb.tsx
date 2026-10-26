import { useState } from "react";
import { staticUrl } from "@/lib/api";

// A challenge thumbnail that cross-fades to the target's hover frame while the
// pointer is on its tile, with a "has :hover" chip. The hover frame loads on the
// first hover only; targets without one simply keep their thumbnail.

export function HoverThumb({ id, title, background }: { id: string; title: string; background: string }) {
  const [want, setWant] = useState(false);
  const [has, setHas] = useState(false);
  return (
    <span className={`d-hthumb${has ? " has" : ""}`} onPointerEnter={() => setWant(true)}>
      <img src={staticUrl(`/targets/${id}/thumb.png`)} alt={title} style={{ background }} loading="lazy" />
      {want ? <img className="hv" src={staticUrl(`/targets/${id}/hover.png`)} alt="" aria-hidden="true" onLoad={() => setHas(true)} onError={() => setWant(false)} /> : null}
      {has ? <span className="hchip">has :hover</span> : null}
    </span>
  );
}
