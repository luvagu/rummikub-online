// Player names: one limit, one cleaner, used by every place a name comes in (the Home field, saved names, the host's join,
// the guest hello). The host is the authority (Game.join), so a modified client cannot send a longer one.
export const NAME_MAX = 14

// Collapse runs of whitespace, trim, and cut to NAME_MAX code points (never half an emoji or a base letter without its accent).
// Returns '' when nothing is left; callers decide the fallback.
export const cleanName = n => {
	const s = typeof n === 'string' ? n.replace(/\s+/gu, ' ').trim() : ''
	const cut = [...s].slice(0, NAME_MAX).join('')
	return cut.normalize('NFC').trimEnd()
}
