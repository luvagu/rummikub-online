// How the table is displayed: number format, drag-and-drop capability and the table pattern choice.
import { local } from "../../utils/store.js";

export const SIGNED = new Intl.NumberFormat("en", { signDisplay: "exceptZero", useGrouping: false }); // +12 / -5 / 0
export const DND_MQ = "(hover: hover) and (pointer: fine) and (min-width: 900px)";
export const BGS = 8; // table patterns (CSS classes bg0..bg7)

// The saved choice is either a pattern id (0..BGS-1) or SHUFFLE: a fresh pattern every session. Shuffle is the default.
// New storage key: the legacy `rmkBg` held an index into the old ten patterns, so it is ignored on purpose.
export const SHUFFLE = "s";
export const parseBgMode = v => {
  const n = Number.parseInt(v, 10);
  return v !== SHUFFLE && Number.isInteger(n) && n >= 0 && n < BGS ? n : SHUFFLE;
};
export const loadBgMode = () => parseBgMode(local.get("rmkTable"));
export const saveBgMode = mode => local.set("rmkTable", mode);

// Menu cycle: Shuffle, 0, 1 ... BGS-1, back to Shuffle.
export const nextBgMode = mode => (mode === SHUFFLE ? 0 : mode + 1 < BGS ? mode + 1 : SHUFFLE);

// A random pattern that is not `last` (so two sessions in a row never look the same).
const rand = () => (globalThis.crypto?.getRandomValues ? globalThis.crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32 : Math.random());
export const pickBg = (last, rnd = rand) => {
  const skip = Number.isInteger(last) && last >= 0 && last < BGS;
  const pool = BGS - (skip ? 1 : 0);
  const i = Math.min(pool - 1, Math.floor(rnd() * pool));
  return skip && i >= last ? i + 1 : i;
};
export const loadLastBg = () => {
  const n = Number.parseInt(local.get("rmkTableLast"), 10);
  return Number.isInteger(n) ? n : -1;
};
export const saveLastBg = bg => local.set("rmkTableLast", bg);

// The pattern a session starts with.
export const initialBg = mode => (mode === SHUFFLE ? pickBg(loadLastBg()) : mode);
