import { avatarColor } from "./PackCard";
import { initials } from "./Shell";

// A player's token (docs/design/rendered-assets.md): Blender-rendered brass rim over a glassy enamel
// face. The face render is neutral grey, and CSS blends the player's own colour into it (overlay), so one
// image gives every player their colour with real highlights. A photo, when there is one, sits
// inside the rim instead of the enamel. The initials are live text.

export function Token({ handle, image, size = 26, me = false, title }: { handle: string; image?: string | null; size?: number; me?: boolean; title?: string }) {
  const color = me ? "#5B4FD6" : avatarColor(handle);
  return (
    <span className="d-token" style={{ width: size, height: size, ["--tok" as string]: color }} title={title} aria-hidden="true">
      {image ? <img className="ph" src={image} alt="" /> : <span className="face" />}
      {image ? null : (
        <span className="ini" style={{ fontSize: Math.max(7, Math.round(size * 0.34)) }}>
          {initials(handle)}
        </span>
      )}
      <span className="rim" />
    </span>
  );
}
