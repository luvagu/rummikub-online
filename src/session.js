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
