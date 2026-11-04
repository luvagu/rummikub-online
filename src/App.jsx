import { useState, useEffect, useRef } from 'react'
import { LoaderCircle } from 'lucide-react'
import { hostGame, joinGame, localGame, TOK } from './net.js'
import { LangCtx, fmt, guessLang } from './i18n.js'
import {
	saveSess,
	loadSess,
	loadSnap,
	clearSess,
	loadNames,
	rememberName,
	forgetName,
} from './session.js'
import { Toasts, Modal } from './ui.jsx'
import { Home, Lobby } from './screens.jsx'
import Game from './Game.jsx'
import Rules from './Rules.jsx'
import { useT } from './i18n.js'
import { unlockAudio } from './notify.js'

function LeaveDialog({ mode, phase, onYes, onNo }) {
	const t = useT(),
		lobby = phase === 'lobby'
	const msg =
		mode === 'solo'
			? 'lv.solo'
			: mode === 'host'
				? lobby
					? 'lv.hostLobby'
					: 'lv.hostPlay'
				: lobby
					? 'lv.guestLobby'
					: 'lv.guestPlay'
	return (
		<Modal title={t('leaveT')} onClose={onNo}>
			<h2>{t('leaveT')}</h2>
			<p>{t(msg)}</p>
			<div className='row'>
				<button data-autofocus onClick={onNo}>
					{t('stay')}
				</button>
				<button className='primary danger' onClick={onYes}>
					{mode === 'host' ? t('endAll') : t('confirmLeave')}
				</button>
			</div>
		</Modal>
	)
}

export default function App() {
	const [lang, setLangState] = useState(guessLang)
	const setLang = l => {
		setLangState(l)
		try {
			localStorage.rmkLang = l
		} catch (e) {}
	}
	const t = (k, p) => fmt(lang, k, p)
	useEffect(() => {
		document.documentElement.lang = lang
	}, [lang])
	useEffect(() => {
		// browsers only allow sound after a user gesture: unlock on the first tap/click/key
		const u = () => unlockAudio(),
			ev = ['click', 'touchend', 'keydown']
		ev.forEach(e => window.addEventListener(e, u, { passive: true }))
		return () => ev.forEach(e => window.removeEventListener(e, u))
	}, [])

	const hash0 = useRef(location.hash.slice(1).toUpperCase())
	const [net, setNet] = useState(null),
		[s, setS] = useState(null),
		[busy, setBusy] = useState(null),
		[conn, setConn] = useState(true)
	const [toasts, setToasts] = useState([]),
		[rules, setRules] = useState(false),
		[leaving, setLeaving] = useState(false)
	const [saved, setSaved] = useState(() => loadSess(true))
	const [name, setName] = useState(() => {
		try {
			return sessionStorage.rmkName || localStorage.rmkName || ''
		} catch (e) {
			return ''
		}
	})
	const [code, setCode] = useState(() =>
		/^[A-Z0-9]{5}$/.test(hash0.current) ? hash0.current : '',
	)
	const [nameErr, setNameErr] = useState(false),
		[names, setNames] = useState(loadNames)
	// Arrived through an invite link (and not auto-resuming that same room): show the minimal join screen
	const [invite, setInvite] = useState(
		() =>
			/^[A-Z0-9]{5}$/.test(hash0.current) &&
			!(saved && saved.code === hash0.current),
	)
	const sess = useRef(null),
		netRef = useRef(null)

	const toast = (m, type = 'err') => {
		const id = Math.random()
		setToasts(l => [...l.slice(-2), { id, m, type }])
		setTimeout(
			() => setToasts(l => l.filter(x => x.id !== id)),
			type === 'err' ? 5000 : 3200,
		)
	}
	const forget = mode => {
		clearSess(mode)
		setSaved(null)
	}

	const start = (mode, o = {}) => {
		const nm = (o.name || name).trim()
		if (!nm) {
			setNameErr(true)
			toast({ k: 'needName' })
			return
		}
		setNameErr(false)
		rememberName(nm)
		setNames(loadNames())
		const tok = o.tok || TOK,
			cd = mode === 'join' ? o.code || code : ''
		try {
			sessionStorage.rmkName = nm
			localStorage.rmkName = nm
		} catch (e) {}
		let snap
		if (o.resume && mode !== 'join') {
			snap = loadSnap(mode === 'host' ? 'rmkHost' : 'rmkSolo')
			if (!snap || (mode === 'host' && snap.code !== o.code)) {
				forget(mode)
				return
			}
		}
		sess.current = { mode, name: nm, code: cd, tok }
		saveSess(sess.current)
		setBusy(o.resume ? 'resume' : mode === 'host' ? 'create' : mode)
		let n
		const cb = {
			onState: st => {
				setS(st)
				setBusy(null)
				if (n && n.code && sess.current && sess.current.code !== n.code) {
					sess.current = { ...sess.current, code: n.code }
					saveSess(sess.current)
				}
			},
			onErr: (m, fatal) => {
				toast(m)
				if (fatal) {
					setBusy(null)
					setNet(null)
					setS(null)
					setConn(true)
					n && n.close()
					if (m && (m.k === 'e.closed' || m.k === 'e.full')) forget(mode)
				}
			},
			onConn: ok => setConn(ok),
		}
		n = (
			mode === 'host'
				? hostGame
				: mode === 'solo'
					? localGame
					: (nm2, c2, tk) => joinGame(cd, nm2, c2, tk)
		)(nm, cb, tok, snap || undefined)
		netRef.current = n
		setNet(n)
	}
	const cancel = () => {
		const r = busy === 'resume'
		netRef.current && netRef.current.close()
		setNet(null)
		setS(null)
		setBusy(null)
		if (!r && sess.current) forget(sess.current.mode)
	}
	const resumeSaved = () =>
		start(saved.mode, {
			resume: true,
			name: saved.name,
			tok: saved.tok,
			code: saved.code,
		})

	// Rejoin automatically after a refresh / reopened tab (unless the URL is an invite to a different room).
	useEffect(() => {
		if (saved && (!hash0.current || hash0.current === saved.code)) resumeSaved()
	}, [])

	const doLeave = () => {
		const mode = sess.current ? sess.current.mode : 'solo'
		if (mode === 'join') net.send({ t: 'leave' })
		if (mode === 'host' && net.endRoom) net.endRoom()
		else net.close()
		forget(mode)
		setNet(null)
		setS(null)
		setLeaving(false)
		setConn(true)
		setCode('')
		history.replaceState(null, '', location.pathname + location.search)
		hash0.current = ''
		setInvite(false)
		toast({ k: 'n.youLeft' }, 'info')
	}

	// Connection banner + "back online" toast
	const wasOff = useRef(false)
	useEffect(() => {
		if (!conn) wasOff.current = true
		else if (wasOff.current) {
			wasOff.current = false
			toast({ k: 'n.online' }, 'ok')
		}
	}, [conn])
	// Presence toasts: someone joined / lost connection / came back / left
	const prev = useRef(null)
	useEffect(() => {
		if (!s) {
			prev.current = null
			return
		}
		const cur = Object.fromEntries(s.players.map(p => [p.id, p])),
			meId = s.players[s.me] && s.players[s.me].id
		if (prev.current) {
			for (const id in cur) {
				const p = cur[id],
					o = prev.current[id]
				if (id === meId) continue
				if (!o) {
					if (!p.bot) toast({ k: 'n.joined', p: { name: p.name } }, 'info')
				} else if (!o.bot && p.bot)
					toast({ k: 'n.left', p: { name: p.name } }, 'info')
				else if (!p.bot && o.on && !p.on)
					toast({ k: 'n.off', p: { name: p.name } }, 'warn')
				else if (!p.bot && !o.on && p.on)
					toast({ k: 'n.back', p: { name: p.name } }, 'ok')
			}
			for (const id in prev.current)
				if (!cur[id] && !prev.current[id].bot)
					toast({ k: 'n.left', p: { name: prev.current[id].name } }, 'info')
		}
		prev.current = cur
	}, [s])

	const link = () =>
		location.origin + location.pathname + '#' + (net && net.code)
	const copy = async what => {
		const txt = what === 'code' ? net.code : link()
		let ok = false
		try {
			await navigator.clipboard.writeText(txt)
			ok = true
		} catch (e) {
			try {
				const ta = document.createElement('textarea')
				ta.value = txt
				ta.style.cssText = 'position:fixed;opacity:0'
				document.body.appendChild(ta)
				ta.select()
				ok = document.execCommand('copy')
				ta.remove()
			} catch (e2) {}
		}
		toast(
			{
				k: ok ? (what === 'code' ? 'n.codeCopied' : 'n.copied') : 'n.copyFail',
			},
			ok ? 'ok' : 'err',
		)
		return ok
	}
	const share = () =>
		navigator.share &&
		navigator
			.share({
				title: 'Rummikub',
				text: t('shareText', { code: net.code }),
				url: link(),
			})
			.catch(() => {})
	const openRules = () => setRules(true),
		inRoom = !!(s && net)
	const backFromInvite = () => {
		setInvite(false)
		setCode('')
		hash0.current = ''
		history.replaceState(null, '', location.pathname + location.search)
	}

	return (
		<LangCtx.Provider value={{ lang, setLang }}>
			{!conn && inRoom && (
				<div className='banner' role='status'>
					<LoaderCircle className='spin' size={16} />
					{t('reconnecting')}
				</div>
			)}
			{!inRoom ? (
				<Home
					{...{
						name,
						setName,
						nameErr,
						names,
						code,
						setCode,
						start,
						busy,
						cancel,
						saved,
						openRules,
						invite,
					}}
					onForgetName={n => {
						forgetName(n)
						setNames(loadNames())
					}}
					onBack={backFromInvite}
					onResume={resumeSaved}
					onForget={() => forget(saved.mode)}
				/>
			) : s.phase === 'lobby' ? (
				<Lobby
					s={s}
					net={net}
					copy={copy}
					share={share}
					leave={() => setLeaving(true)}
					openRules={openRules}
				/>
			) : (
				<Game
					s={s}
					net={net}
					toast={toast}
					openRules={openRules}
					onLeave={() => setLeaving(true)}
				/>
			)}
			{rules && <Rules close={() => setRules(false)} />}
			{leaving && (
				<LeaveDialog
					mode={sess.current ? sess.current.mode : 'solo'}
					phase={s ? s.phase : 'lobby'}
					onYes={doLeave}
					onNo={() => setLeaving(false)}
				/>
			)}
			<Toasts list={toasts} t={t} />
		</LangCtx.Provider>
	)
}
