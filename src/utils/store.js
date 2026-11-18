// Guarded wrappers around Web Storage. Touching storage can throw (blocked site data, some private modes,
// quota), so the try/catch lives here once instead of at every call site. Key names are unchanged, so
// saved games, names and preferences written by earlier versions still load.
const area = name => {
	try {
		return globalThis[name] ?? null
	} catch {
		return null
	}
}
const wrap = name => ({
	get(k, fallback = null) {
		try {
			return area(name)?.getItem(k) ?? fallback
		} catch {
			return fallback
		}
	},
	set(k, v) {
		try {
			area(name).setItem(k, String(v))
			return true
		} catch {
			return false
		}
	},
	remove(k) {
		try {
			area(name)?.removeItem(k)
		} catch {}
	},
	getJSON(k, fallback = null) {
		try {
			const v = area(name)?.getItem(k)
			return v == null ? fallback : JSON.parse(v)
		} catch {
			return fallback
		}
	},
	setJSON(k, v) {
		try {
			area(name).setItem(k, JSON.stringify(v))
			return true
		} catch {
			return false
		}
	},
})
export const local = wrap('localStorage') // survives closing the browser
export const session = wrap('sessionStorage') // this tab only
