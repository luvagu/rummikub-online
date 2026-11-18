// How the table is displayed: number format, drag-and-drop capability and the table pattern choice.
import { local } from "../../utils/store.js";

export const SIGNED = new Intl.NumberFormat("en", { signDisplay: "exceptZero", useGrouping: false }); // +12 / -5 / 0
export const DND_MQ = "(hover: hover) and (pointer: fine) and (min-width: 900px)";
export const BGS = 10; // table patterns (CSS classes bg0..bg9)
export const loadBg = () =>
  Math.min(BGS - 1, Math.max(0, parseInt(local.get("rmkBg")) || 0));
