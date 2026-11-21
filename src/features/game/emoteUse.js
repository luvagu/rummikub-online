// How often this player sends each emote ({key: count}), kept in this browser only. It orders the picker (reactions.js orderByUse).
import { local } from '../../utils/store.js'

const KEY = 'rmkEmoteUse'
export const loadUse = () => {
	try {
		const v = JSON.parse(local.get(KEY, '{}'))
		return v && typeof v === 'object' && !Array.isArray(v) ? v : {}
	} catch {
		return {}
	}
}
export const saveUse = counts => local.set(KEY, JSON.stringify(counts))
