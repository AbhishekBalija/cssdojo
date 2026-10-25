import type { Belt as BeltName } from "@cssdojo/shared";
import { BELT_COLOR, beltLabel } from "@/lib/belts";

export function Belt({ belt, label }: { belt: BeltName; label?: string }) {
  return (
    <span className="belt">
      <i style={{ background: BELT_COLOR[belt] }} />
      {label ?? beltLabel(belt)}
    </span>
  );
}
