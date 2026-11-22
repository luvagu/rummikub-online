import { local, session } from '../utils/store.js'
import { cleanName } from '../engine/names.js'

// Remembers the current room so a refreshed/closed tab (or a restarted browser) can rejoin it.
// sessionStorage = this tab; localStorage = survives closing the browser. Host/solo games also keep a snapshot.
export const saveSess = o => {
	session.setJSON('rmkSess', o)
	local.setJSON('rmkSess', o)
}
export const loadSess = useLocal =>
	session.getJSON('rmkSess') ?? (useLocal ? local.getJSON('rmkSess') : null)
export const loadSnap = k => local.getJSON(k)
export const clearSess = mode => {
	session.remove('rmkSess')
	session.remove('rmkDealt') // the next game in this tab gets its deal animation
	local.remove('rmkSess')
	if (mode === 'host') local.remove('rmkHost')
	if (mode === 'solo') local.remove('rmkSolo')
}

// Recently used player names (most recent first) so the name field can offer them again.
export const loadNames = () => {
	const v = local.getJSON('rmkNames', [])
	// older saved names may be longer than today's limit: cut them (and drop duplicates / empties the cut leaves)
	return Array.isArray(v) ? [...new Set(v.map(n => cleanName(n)).filter(Boolean))] : []
}
export const rememberName = n =>
	local.setJSON(
		'rmkNames',
		[n, ...loadNames().filter(x => x.toLowerCase() !== n.toLowerCase())].slice(0, 6),
	)
export const forgetName = n =>
	local.setJSON(
		'rmkNames',
		loadNames().filter(x => x !== n),
	)
