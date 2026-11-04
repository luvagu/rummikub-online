// Remembers the current room so a refreshed/closed tab (or a restarted browser) can rejoin it.
// sessionStorage = this tab; localStorage = survives closing the browser. Host/solo games also keep a snapshot.
export const saveSess = o => {
	try {
		const j = JSON.stringify(o)
		sessionStorage.rmkSess = j
		localStorage.rmkSess = j
	} catch (e) {}
}
export const loadSess = local => {
	try {
		return JSON.parse(
			sessionStorage.rmkSess || (local && localStorage.rmkSess) || 'null',
		)
	} catch (e) {
		return null
	}
}
export const loadSnap = k => {
	try {
		return JSON.parse(localStorage[k] || 'null')
	} catch (e) {
		return null
	}
}
export const clearSess = mode => {
	try {
		sessionStorage.removeItem('rmkSess')
		localStorage.removeItem('rmkSess')
		if (mode === 'host') localStorage.removeItem('rmkHost')
		if (mode === 'solo') localStorage.removeItem('rmkSolo')
	} catch (e) {}
}

// Recently used player names (most recent first) so the name field can offer them again.
export const loadNames = () => {
	try {
		return JSON.parse(localStorage.rmkNames || '[]')
	} catch (e) {
		return []
	}
}
export const rememberName = n => {
	try {
		localStorage.rmkNames = JSON.stringify(
			[
				n,
				...loadNames().filter(x => x.toLowerCase() !== n.toLowerCase()),
			].slice(0, 6),
		)
	} catch (e) {}
}
export const forgetName = n => {
	try {
		localStorage.rmkNames = JSON.stringify(loadNames().filter(x => x !== n))
	} catch (e) {}
}
