// Reduced-motion preference shared by the UI. One live MediaQueryList (its .matches always reflects the current preference)
// instead of a new one per call.
const REDUCED_MQ = matchMedia("(prefers-reduced-motion: reduce)");
export const prefersReducedMotion = () => REDUCED_MQ.matches;
// scrollIntoView behaviour that honours it
export const scrollBehavior = () => (prefersReducedMotion() ? "auto" : "smooth");
