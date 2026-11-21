import { useState } from "react";
import { REACTION } from "../../engine/reactions.js";
import { prefersReducedMotion } from "../../utils/motion.js";

// One table emote. The animation is public/emotes/<k>.webp (Noto Animated Emoji, see public/emotes/LICENSE.txt); the Unicode
// character is what shows while it loads, if it cannot load (offline and never shown before) and with reduced motion
// (an animated WebP cannot be paused). Decorative: the name is spoken by whoever renders it (label, aria-label).
export function Emote({ k, size = 56, className = "" }) {
  const r = REACTION[k],
    [failed, setFailed] = useState(false);
  if (!r) return null;
  const still = failed || prefersReducedMotion();
  return still ? (
    <span className={"emo glyph " + className} style={{ "--emo": size + "px" }} aria-hidden="true">
      {r.e}
    </span>
  ) : (
    <img
      className={"emo " + className}
      style={{ "--emo": size + "px" }}
      src={`${import.meta.env.BASE_URL}emotes/${k}.webp`}
      width={size}
      height={size}
      alt=""
      decoding="async"
      draggable="false"
      onError={() => setFailed(true)}
    />
  );
}

// Fetch every animation into the HTTP/service-worker cache the first time the picker opens, so the first send does not pop in late.
let warmed = false;
export function warmEmotes(keys) {
  if (warmed || prefersReducedMotion()) return;
  warmed = true;
  for (const k of keys) new Image().src = `${import.meta.env.BASE_URL}emotes/${k}.webp`;
}
