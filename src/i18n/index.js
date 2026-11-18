import { createContext, useContext } from 'react'
import { local } from '../utils/store.js'
import { en } from './en.js'
import { es } from './es.js'
// Messages from the game engine/network are {k,p} objects so each player sees them in their own language.
const D = { en, es }
export const fmt = (lang, k, p = {}) => {
	const v = (D[lang] && D[lang][k]) ?? D.en[k] ?? k
	return typeof v === 'function' ? v(p) : v
}
// Saved choice first; otherwise the first of the browser's preferred languages that we translate.
export const guessLang = () =>
	local.get('rmkLang') ||
	globalThis.navigator?.languages
		?.map(l => l.slice(0, 2).toLowerCase())
		.find(l => l === 'es' || l === 'en') ||
	'en'
export const LangCtx = createContext({ lang: 'en', setLang() {} })
export const useT = () => {
	const { lang } = useContext(LangCtx)
	return (k, p) => fmt(lang, k, p)
}
export const tr = (t, m) => (!m ? '' : typeof m === 'string' ? m : t(m.k, m.p))
