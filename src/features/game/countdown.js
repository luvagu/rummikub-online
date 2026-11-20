// Turn-timer decision, kept pure (no DOM, no React) so it can be unit-tested. src/features/game/Game.jsx calls it.

// Should this client tell the host its turn has timed out?
// `secs` is the displayed whole-second value, which is React state and can still read 0 from the PREVIOUS turn for one
// render after a new state arrives. Sending on that stale 0 burned the next human's turn instantly, so `now >= dl` (the real
// deadline of the CURRENT turn) is checked as well.
export const timeoutDue = ({ my, secs, dl, now, sent }) => !!my && !sent && dl != null && secs === 0 && now >= dl
