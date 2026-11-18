// Timing of the dealer animation. Shared by the engine (which holds play until the deal is over) and the UI.
export const DEAL_FLY = 560 // ms a dealt tile is in the air
export const DEAL_LEAD = 150 // ms between the round starting and the first tile leaving the pool
export const DEAL_MARGIN = 400 // slack for slow devices / network latency, so no client is still dealing when play opens
export const dealGap = np => Math.max(50, 140 - 20 * np) // ms per tile: 100 (2 players), 80 (3), 60 (4)
// Total time a round of `np` players is on hold while the tiles are dealt.
export const dealHold = np => DEAL_LEAD + 14 * np * dealGap(np) + DEAL_FLY + 80 + DEAL_MARGIN
