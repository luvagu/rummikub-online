// The dealer / draw animation: face-down tiles flying between the pool, the seats and the rack.
import { DEAL_FLY, dealGap } from "../../engine/deal.js";
export { DEAL_FLY, dealGap };
// Fly one face-down tile between two points on a fixed overlay (Web Animations API, self-removing).
// a, b: centres; w, h: the tile's size when it lands (it starts smaller, like leaving the deck).
export const flyTile = (layer, a, b, delay, onEnd, w = 28, h = 38) => {
  if (!layer) return;
  const el = document.createElement("div");
  el.className = "fly-tile";
  el.style.width = w + "px";
  el.style.height = h + "px";
  el.style.left = a.x - w / 2 + "px";
  el.style.top = a.y - h / 2 + "px";
  layer.appendChild(el);
  const rot = (Math.random() * 16 - 8).toFixed(1),
    dx = b.x - a.x,
    dy = b.y - a.y;
  const an = el.animate(
    [
      { transform: "translate(0,0) rotate(-14deg) scale(.55)", opacity: 0 },
      { opacity: 1, offset: 0.1 },
      { transform: `translate(${dx * 0.55}px,${dy * 0.55 - 26}px) rotate(${rot}deg) scale(.95)`, opacity: 1, offset: 0.55 },
      { transform: `translate(${dx}px,${dy}px) rotate(0deg) scale(1)`, opacity: 1, offset: 0.96 },
      { transform: `translate(${dx}px,${dy}px) rotate(0deg) scale(1)`, opacity: 0 },
    ],
    { duration: DEAL_FLY, delay, easing: "cubic-bezier(.3,.6,.35,1)", fill: "both" },
  );
  an.onfinish = () => {
    el.remove();
    onEnd && onEnd();
  };
};
