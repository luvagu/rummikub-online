import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react'
import { LoaderCircle } from 'lucide-react'
import { hostGame, joinGame, localGame, tutorialGame, TOK } from './services/net.js'
import { getIdentity } from './services/identity.js'
import { LangCtx, fmt, guessLang } from './i18n/index.js'
import {
	saveSess,
	loadSess,
	loadSnap,
	clearSess,
	loadNames,
	rememberName,
	forgetName,
} from './services/session.js'
import { Toasts } from './components/Toasts.jsx'
import { Modal } from './components/Modal.jsx'
import { TopLayer } from './components/TopLayer.jsx'
import { LeaveDialog } from './components/LeaveDialog.jsx'
import { UpdateBanner } from './components/UpdateBanner.jsx'
import { RotateHint } from './components/RotateHint.jsx'
import { EdgeCap } from './components/EdgeCap.jsx'
import { Home } from './features/home/Home.jsx'
import { Lobby } from './features/lobby/Lobby.jsx'
import Game from './features/game/Game.jsx'
import { unlockAudio } from './utils/notify.js'
import { local, session } from './utils/store.js'

// secondary screens load on first use
const Rules = lazy(() => import('./features/rules/Rules.jsx'))
const Tutorial = lazy(() => import('./features/tutorial/Tutorial.jsx'))

const isCode = c => /^[A-Z0-9]{5}$/.test(c) // room code in an invite link (#ABCDE)

export default function App() {
	const [lang, setLangState] = useState(guessLang)
	const setLang = l => {
		setLangState(l)
		local.set('rmkLang', l)
	}
	const t = (k, p) => fmt(lang, k, p)
	useEffect(() => {
		document.documentElement.lang = lang
	}, [lang])
	useEffect(() => {
		// browsers only allow sound after a user gesture: unlock on the first tap/click/key
		const ac = new AbortController()
		for (const e of ['click', 'touchend', 'keydown'])
			addEventListener(e, () => unlockAudio(), { passive: true, signal: ac.signal })
		return () => ac.abort()
	}, [])

	const hash0 = useRef(location.hash.slice(1).toUpperCase())
	const [net, setNet] = useState(null),
		[s, setS] = useState(null),
		[busy, setBusy] = useState(null),
		[conn, setConn] = useState(true),
		[draft, setDraft] = useState({ sel: [], b: [], r: [] }) // tutorial: the player's unsent edits, reported by Game
	const [gk, setGk] = useState(0) // bumped on every new session so Game / Tutorial remount with fresh local state
	const tutReport = useCallback(
		(sel, d) => setDraft({ sel, b: d.b, r: d.r }),
		[],
	)
	const rbus = useRef(new Set()) // reaction events -> whoever is subscribed (the Game screen)
	const reacts = useRef(f => {
		rbus.current.add(f)
		return () => rbus.current.delete(f)
	}).current
	const [toasts, setToasts] = useState([]),
		[rules, setRules] = useState(false),
		[leaving, setLeaving] = useState(false)
	const [saved, setSaved] = useState(() => loadSess(true))
	const [name, setName] = useState(
		() => session.get('rmkName') || local.get('rmkName') || '',
	)
	const [code, setCode] = useState(() =>
		isCode(hash0.current) ? hash0.current : '',
	)
	const [nameErr, setNameErr] = useState(false),
		[names, setNames] = useState(loadNames)
	// Arrived through an invite link (and not auto-resuming that same room): show the minimal join screen
	const [invite, setInvite] = useState(
		() =>
			isCode(hash0.current) &&
			!(saved && saved.code === hash0.current),
	)
	const sess = useRef(null),
		netRef = useRef(null)

	// Toasts (Toasts.jsx): at most 3 on screen, the oldest makes room; a repeat of a visible one counts up (×2) and
	// restarts its countdown instead of stacking. `quiet` ones are only announced to screen readers (their feedback is
	// already on screen, like the copy bubble). Lifetimes run in CSS, so hovering or focusing the stack pauses them.
	const toast = (m, type = 'err', { quiet = false } = {}) => {
		const id = Math.random(),
			key = type + JSON.stringify(m)
		setToasts(l => {
			const dup = !quiet && l.find(x => x.key === key && !x.leaving && !x.quiet)
			if (dup) return l.map(x => (x === dup ? { ...x, n: x.n + 1 } : x))
			const shown = l.filter(x => !x.leaving && !x.quiet),
				oldest = shown.length >= 3 ? shown[0].id : null
			return [
				...l.map(x => (x.id === oldest ? { ...x, leaving: true } : x)),
				{ id, key, m, type, n: 1, quiet, life: type === 'err' ? 6000 : 3600 },
			]
		})
		if (quiet) setTimeout(() => setToasts(l => l.filter(x => x.id !== id)), 4000)
	}
	const dismissToast = id => setToasts(l => l.map(x => (x.id === id ? { ...x, leaving: true } : x)))
	const dropToasts = ids => setToasts(l => l.filter(x => !ids.includes(x.id)))
	const forget = mode => {
		clearSess(mode)
		setSaved(null)
	}

	const start = (mode, o = {}) => {
		const nm = (o.name || name).trim()
		if (!nm) {
			setNameErr(true)
			// no toast: the field's own message says it. Focus the field once the error has rendered, so aria-describedby
			// is set and a screen reader reads "Your name, invalid, Please enter your name first" (and the keyboard opens)
			requestAnimationFrame(() => document.getElementById('rmk-name')?.focus())
			return
		}
		setNameErr(false)
		rememberName(nm)
		setNames(loadNames())
		// Online rooms use a key pair whose hash is the public player id (identity.js); offline games just need a random id.
		const online = mode === 'host' || mode === 'join',
			identP = online ? getIdentity(o.ident) : null,
			tok = o.tok || TOK,
			cd = mode === 'join' ? o.code || code : ''
		session.set('rmkName', nm)
		local.set('rmkName', nm)
		let snap
		if (o.resume && mode !== 'join') {
			snap = loadSnap(mode === 'host' ? 'rmkHost' : 'rmkSolo')
			// a host snapshot from before the encrypted protocol has other ids and unreachable guests: drop it
			if (!snap || (mode === 'host' && (snap.code !== o.code || snap.proto !== 8))) {
				forget(mode)
				return
			}
		}
		// Close any previous connection first: otherwise it keeps auto-reconnecting in the background
		// and its callbacks would overwrite this new room's state/session.
		const prev = netRef.current
		netRef.current = null
		prev && prev.close()
		setConn(true) // fresh session: never inherit an old "offline" state
		setGk(k => k + 1)
		sess.current = { mode, name: nm, code: cd, tok, lesson: o.lesson }
		if (mode !== 'tutorial') saveSess(sess.current) // the tutorial is never resumed
		// once the key pair exists, remember it (and the public id) with the session, so a closed browser can resume the seat
		if (online)
			identP
				.then(id => {
					if (!sess.current || sess.current.mode !== mode) return
					sess.current = { ...sess.current, tok: id.kid, ident: id.exported }
					saveSess(sess.current)
				})
				.catch(() => {}) // no WebCrypto: hostGame/joinGame report it
		setBusy(
			o.resume
				? 'resume'
				: mode === 'host'
					? 'create'
					: mode === 'tutorial'
						? 'solo'
						: mode,
		)
		let n
		const stale = () => !!n && netRef.current !== n // a closed/replaced connection must not touch the UI
		const cb = {
			onState: st => {
				if (stale()) return
				setS(st)
				setBusy(null)
				if (
					n &&
					n.code &&
					sess.current &&
					sess.current.mode !== 'tutorial' &&
					sess.current.code !== n.code
				) {
					sess.current = { ...sess.current, code: n.code }
					saveSess(sess.current)
				}
			},
			onReact: r => !stale() && rbus.current.forEach(f => f(r)),
			onErr: (m, fatal) => {
				if (stale()) return
				toast(m)
				if (fatal) {
					setBusy(null)
					setNet(null)
					setS(null)
					setConn(true)
					n && n.close()
					netRef.current = null
					if (m && (m.k === 'e.closed' || m.k === 'e.full')) forget(mode)
				}
			},
			onConn: ok => netRef.current === n && setConn(ok), // ignore a closed/old connection
		}
		n = (
			mode === 'host'
				? hostGame
				: mode === 'solo'
					? (nm2, c2, tk, sn) => localGame(nm2, c2, tk, sn, l => t('botName', { lvl: t('lvl' + l) }))
					: mode === 'tutorial'
						? (nm2, c2, tk) => tutorialGame(nm2, c2, tk, t('tutBot'), o.lesson)
						: (nm2, c2, tk) => joinGame(cd, nm2, c2, tk)
		)(nm, cb, online ? identP : tok, snap || undefined)
		netRef.current = n
		setNet(n)
	}
	const cancel = () => {
		const r = busy === 'resume'
		netRef.current && netRef.current.close()
		netRef.current = null
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
			ident: saved.ident,
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
		netRef.current = null
		forget(mode)
		setNet(null)
		setS(null)
		setLeaving(false)
		setConn(true)
		setCode('')
		history.replaceState(null, '', location.pathname + location.search)
		hash0.current = ''
		setInvite(false)
		if (mode === 'host' || mode === 'join') toast({ k: 'n.youLeft' }, 'info') // a solo game or a lesson is not a room
	}

	// Connection banner + "back online" toast
	const wasOff = useRef(false)
	useEffect(() => {
		if (!conn) {
			wasOff.current = true
			toast({ k: 'reconnecting' }, 'warn', { quiet: true }) // the pill shows it; this announces it
		} else if (wasOff.current) {
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
			{ quiet: true }, // seen on the button itself (CopyBubble.jsx); announced from here
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
	const whatsappUrl =
		net &&
		'https://wa.me/?text=' +
			encodeURIComponent(t('shareText', { code: net.code }) + ' ' + link())
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
			<TopLayer open={!conn && inRoom} keepOnTop className='banner' role='status'>
				<LoaderCircle className='spin' size={16} aria-hidden='true' />
				{t('reconnecting')}
			</TopLayer>
			<UpdateBanner hidden={!conn} />
			<RotateHint />
			{!(inRoom && s.phase !== 'lobby') && <EdgeCap />}
			{!inRoom ? (
				<Home
					{...{
						name,
						setName: v => {
							setName(v)
							setNameErr(false) // the error is about an empty name: it goes as soon as the player types
						},
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
					whatsappUrl={whatsappUrl}
					leave={() => setLeaving(true)}
					openRules={openRules}
				/>
			) : (
				<Game
					key={'game' + gk}
					s={s}
					net={net}
					toast={toast}
					reacts={reacts}
					offline={!conn && sess.current?.mode === 'join'}
					copy={copy}
					share={share}
					whatsappUrl={whatsappUrl}
					tut={
						sess.current && sess.current.mode === 'tutorial'
							? tutReport
							: undefined
					}
					openRules={openRules}
					onLeave={() => setLeaving(true)}
				/>
			)}
			{inRoom &&
				s &&
				s.phase === 'play' &&
				sess.current &&
				sess.current.mode === 'tutorial' && (
					<Suspense fallback={null}>
					<Tutorial
						key={'tutorial' + gk} // must differ from Game's key: they are siblings, and equal keys make React mount Game over and over
						s={s}
						draft={draft}
						lesson={sess.current.lesson}
						onNext={l => {
							doLeave()
							start('tutorial', { lesson: l })
						}}
						onExit={() => setLeaving(true)}
						onRules={openRules}
						onPlay={() => {
							doLeave()
							start('solo')
						}}
						onFinish={doLeave}
					/>
					</Suspense>
				)}
			{rules && (
				<Suspense fallback={null}>
					<Rules close={() => setRules(false)} />
				</Suspense>
			)}
			{leaving && (
				<LeaveDialog
					mode={sess.current ? sess.current.mode : 'solo'}
					phase={s ? s.phase : 'lobby'}
					onYes={doLeave}
					onNo={() => setLeaving(false)}
				/>
			)}
			<Toasts list={toasts} t={t} onDismiss={dismissToast} onGone={dropToasts} />
		</LangCtx.Provider>
	)
}
