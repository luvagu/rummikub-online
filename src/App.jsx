import { useState, useEffect, useRef, useContext } from 'react'
import { COLORS, T, analyze, key } from './game.js'
import { hostGame, joinGame, localGame } from './net.js'
import { LangCtx, useT, fmt, tr, guessLang } from './i18n.js'
import Rules from './Rules.jsx'
import {
	getPrefs,
	setPref,
	canVibrate,
	unlockAudio,
	chime,
	buzz,
	notifyTurn,
} from './notify.js'

const Tile = ({ id, sel, num, onClick }) => {
	const t = T(id)
	return (
		<button
			className={'tile' + (sel ? ' sel' : '')}
			style={{ color: t.j ? '#7b1fa2' : COLORS[t.c] }}
			onClick={onClick}
		>
			{t.j ? <>☺{num ? <small>{num}</small> : null}</> : t.n}
		</button>
	)
}
const LangBtn = ({ inline }) => {
	const { lang, setLang } = useContext(LangCtx)
	return (
		<button
			className={inline ? '' : 'lang'}
			aria-label='Language / Idioma'
			onClick={() => setLang(lang === 'en' ? 'es' : 'en')}
		>
			{lang === 'en' ? 'Español' : 'English'}
		</button>
	)
}

function Home({ name, setName, code, setCode, go, busy, openRules }) {
	const t = useT()
	return (
		<div className='home'>
			<LangBtn />
			<h1>Rummikub</h1>
			<p className='sub'>{t('sub')}</p>
			<input
				placeholder={t('name')}
				maxLength={16}
				value={name}
				onChange={e => setName(e.target.value)}
			/>
			<button className='primary' disabled={busy} onClick={() => go('solo')}>
				{t('solo')}
			</button>
			<button disabled={busy} onClick={() => go('host')}>
				{t('create')}
			</button>
			<div className='or'>{t('or')}</div>
			<input
				placeholder={t('code')}
				maxLength={5}
				value={code}
				onChange={e => setCode(e.target.value.toUpperCase())}
			/>
			<button disabled={busy || code.length < 4} onClick={() => go('join')}>
				{busy ? t('connecting') : t('join')}
			</button>
			<button className='link' onClick={openRules}>
				{t('readRules')}
			</button>
		</div>
	)
}

function Lobby({ s, net, openRules }) {
	const t = useT(),
		host = s.me === 0,
		link = location.origin + location.pathname + '#' + net.code
	return (
		<div className='home'>
			<LangBtn />
			<h1>
				{t('room')} <b className='code'>{net.code}</b>
			</h1>
			<button
				onClick={() =>
					navigator.clipboard && navigator.clipboard.writeText(link)
				}
			>
				{t('copy')}
			</button>
			<ul className='plist'>
				{s.players.map((p, i) => (
					<li key={p.id}>
						{p.name}
						{i === 0 && ' ' + t('host')}
						{p.bot && ' ' + t('bot')}
						{p.on === false && ' ' + t('off')}
					</li>
				))}
			</ul>
			{host ? (
				<>
					<div className='row'>
						<button
							disabled={s.players.length >= 4}
							onClick={() => net.send({ t: 'bot' })}
						>
							{t('addBot')}
						</button>
						{s.players.some(p => p.bot) && (
							<button onClick={() => net.send({ t: 'unbot' })}>
								{t('rmBot')}
							</button>
						)}
					</div>
					<label>
						<input
							type='checkbox'
							checked={s.opts.timer}
							onChange={e => net.send({ t: 'opts', timer: e.target.checked })}
						/>{' '}
						{t('timer')}
					</label>
					<button
						className='primary'
						disabled={s.players.length < 2}
						onClick={() => net.send({ t: 'start' })}
					>
						{t('start', { n: s.players.length })}
					</button>
					<p className='sub'>{t('keep')}</p>
				</>
			) : (
				<p>{t('waitHost')}</p>
			)}
			<button className='link' onClick={openRules}>
				{t('readRules')}
			</button>
		</div>
	)
}

function Game({ s, net, openRules }) {
	const t = useT(),
		me = s.me,
		my = s.phase === 'play' && s.turn === me
	const [d, setD] = useState({ b: s.board, r: s.rack }),
		[sel, setSel] = useState([]),
		[left, setLeft] = useState(60)
	const dirty = useRef(false)
	dirty.current = d.r.length !== s.rack.length
	const [pf, setPf] = useState(getPrefs)
	const flip = k => {
		const v = !pf[k]
		setPref(k, v)
		setPf(getPrefs())
		if (v) {
			if (k === 'sound') {
				unlockAudio()
				chime()
			} else buzz()
		}
	}
	useEffect(() => {
		if (my) notifyTurn()
	}, [s.seq]) // chime + vibrate each time a new turn starts for me
	useEffect(() => {
		// also flag it in the tab title when the tab is in the background
		const base = 'Rummikub Online',
			upd = () => {
				document.title =
					my && document.hidden ? `● ${t('turnMine')} – ${base}` : base
			}
		upd()
		document.addEventListener('visibilitychange', upd)
		return () => {
			document.removeEventListener('visibilitychange', upd)
			document.title = base
		}
	}, [my, s.seq])
	useEffect(() => {
		setD({ b: s.board, r: s.rack })
		setSel([])
	}, [s.seq, s.phase])
	useEffect(() => {
		if (!s.opts.timer || s.phase !== 'play') return
		const t0 = Date.now()
		setLeft(60)
		const iv = setInterval(() => {
			const l = 60 - Math.floor((Date.now() - t0) / 1000)
			setLeft(Math.max(l, 0))
			if (l <= 0) {
				clearInterval(iv)
				if (my) net.send({ t: 'timeout', dirty: dirty.current })
			}
		}, 500)
		return () => clearInterval(iv)
	}, [s.seq, s.phase])

	const norm = b => b.filter(x => x.length).map(x => analyze(x).order)
	const strip = b => b.map(x => x.filter(i => !sel.includes(i)))
	const toggle = id =>
		my && setSel(v => (v.includes(id) ? v.filter(x => x !== id) : [...v, id]))
	const fromRack = r => r.filter(i => !sel.includes(i))
	const newSet = () => {
		setD({ b: norm([...strip(d.b), sel]), r: fromRack(d.r) })
		setSel([])
	}
	const addTo = k => {
		const b = strip(d.b)
		b[k] = [...b[k], ...sel]
		setD({ b: norm(b), r: fromRack(d.r) })
		setSel([])
	}
	const back = () => {
		const bk = sel.filter(i => s.rack.includes(i) && !d.r.includes(i))
		setD({
			b: norm(d.b.map(x => x.filter(i => !bk.includes(i)))),
			r: [...d.r, ...bk],
		})
		setSel([])
	}
	const reset = () => {
		setD({ b: s.board, r: s.rack })
		setSel([])
	}
	const sortR = byColor =>
		setD({
			...d,
			r: [...d.r].sort((a, b) => {
				const x = T(a),
					y = T(b),
					jx = x.j ? 1 : 0,
					jy = y.j ? 1 : 0
				return (
					jx - jy || (byColor ? x.c - y.c || x.n - y.n : x.n - y.n || x.c - y.c)
				)
			}),
		})

	const info = d.b.map(analyze),
		oldK = new Set(s.board.map(key))
	const pts = d.b.reduce(
		(a, x, j) => a + (oldK.has(key(x)) ? 0 : info[j].val),
		0,
	)
	const allOk = info.every(x => x.ok),
		cur = s.players[s.turn]
	const showAdd = my && sel.length > 0

	return (
		<div className='game'>
			<div className='top'>
				{s.players.map((p, i) => (
					<span
						key={p.id}
						className={
							'chip' +
							(i === s.turn && s.phase === 'play' ? ' act' : '') +
							(p.on === false ? ' off' : '')
						}
					>
						{t('chip', {
							name: p.name,
							you: i === me,
							n: p.n,
							m: p.melded,
							pts: s.scores[p.id],
							w: s.wins[p.id],
						})}
					</span>
				))}
				<span className='chip'>{t('pool', { n: s.pool })}</span>
				{s.opts.timer && s.phase === 'play' && (
					<span className={'chip' + (left <= 10 ? ' warn' : '')}>{left}s</span>
				)}
				<button onClick={openRules}>{t('rules')}</button>
				<button
					title={t('snd')}
					aria-label={t('snd')}
					aria-pressed={pf.sound}
					onClick={() => flip('sound')}
				>
					{pf.sound ? '🔔' : '🔕'}
				</button>
				{canVibrate() && (
					<button
						title={t('vib')}
						aria-label={t('vib')}
						aria-pressed={pf.vibe}
						onClick={() => flip('vibe')}
					>
						{pf.vibe ? '📳' : '📴'}
					</button>
				)}
				<LangBtn inline />
			</div>
			<div className='board'>
				{d.b.map((_, k) => (
					<div key={k} className={'set' + (info[k].ok ? '' : ' bad')}>
						{info[k].order.map((id, j) => (
							<Tile
								key={id}
								id={id}
								sel={sel.includes(id)}
								num={info[k].nums && info[k].nums[j]}
								onClick={() => toggle(id)}
							/>
						))}
						{showAdd && (
							<button className='plus' onClick={() => addTo(k)}>
								＋
							</button>
						)}
					</div>
				))}
				{showAdd && (
					<button className='plus' onClick={newSet}>
						{t('newSet')}
					</button>
				)}
				{!d.b.length && !showAdd && <p className='sub'>{t('empty')}</p>}
			</div>
			<div className='bar'>
				<span className='status'>
					{my
						? s.players[me].melded
							? t('turnMine')
							: t('turnMeld', { pts })
						: t('turnOf', { name: cur.name })}
					. {tr(t, s.log)}
				</span>
				{my && (
					<>
						<button disabled={!sel.length} onClick={back}>
							{t('toRack')}
						</button>
						<button onClick={reset}>{t('undo')}</button>
						<button onClick={() => net.send({ t: 'draw' })}>
							{s.pool ? t('draw') : t('pass')}
						</button>
						<button
							className='primary'
							disabled={!allOk || d.r.length === s.rack.length}
							onClick={() => net.send({ t: 'end', board: d.b, rack: d.r })}
						>
							{t('end')}
						</button>
					</>
				)}
				{!my && me === 0 && s.phase === 'play' && cur.on === false && (
					<button onClick={() => net.send({ t: 'skip' })}>{t('skip')}</button>
				)}
				<button onClick={() => sortR(false)}>{t('sort123')}</button>
				<button onClick={() => sortR(true)}>{t('sortCol')}</button>
			</div>
			<div className='rack'>
				{d.r.map(id => (
					<Tile
						key={id}
						id={id}
						sel={sel.includes(id)}
						onClick={() => toggle(id)}
					/>
				))}
			</div>
			{s.phase === 'over' && (
				<div className='modal'>
					<div className='card'>
						<h2>
							{t(s.result.blocked ? 'winsPool' : 'wins', {
								name: s.players[s.result.winner].name,
							})}
						</h2>
						<ul>
							{s.players.map(p => (
								<li key={p.id}>
									{p.name}: {s.result.delta[p.id] > 0 ? '+' : ''}
									{s.result.delta[p.id]} ({t('total')} {s.scores[p.id]})
								</li>
							))}
						</ul>
						{me === 0 ? (
							<button onClick={() => net.send({ t: 'start' })}>
								{t('next')}
							</button>
						) : (
							<p>{t('waitNext')}</p>
						)}
					</div>
				</div>
			)}
		</div>
	)
}

export default function App() {
	const [net, setNet] = useState(null),
		[s, setS] = useState(null),
		[err, setErr] = useState(null),
		[rules, setRules] = useState(false),
		[busy, setBusy] = useState(false)
	const [lang, setLangState] = useState(guessLang)
	const setLang = l => {
		setLangState(l)
		try {
			localStorage.rmkLang = l
		} catch (e) {}
	}
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
	const [name, setName] = useState(sessionStorage.rmkName || '')
	const [code, setCode] = useState(
		() => location.hash.slice(1).toUpperCase() || sessionStorage.rmkCode || '',
	)
	const toast = m => {
		setErr(m)
		setTimeout(() => setErr(null), 4000)
	}
	const go = mode => {
		if (!name.trim()) return toast({ k: 'needName' })
		sessionStorage.rmkName = name
		if (mode === 'join') sessionStorage.rmkCode = code
		setBusy(true)
		let n
		const cb = {
			onState: st => {
				setS(st)
				setBusy(false)
			},
			onErr: (m, fatal) => {
				toast(m)
				if (fatal) {
					setBusy(false)
					setNet(null)
					setS(null)
					n && n.close()
				}
			},
		}
		n = (
			mode === 'host'
				? hostGame
				: mode === 'solo'
					? localGame
					: (nm, c) => joinGame(code, nm, c)
		)(name.trim(), cb)
		setNet(n)
	}
	const t = (k, p) => fmt(lang, k, p),
		openRules = () => setRules(true)
	return (
		<LangCtx.Provider value={{ lang, setLang }}>
			{!s || !net ? (
				<Home {...{ name, setName, code, setCode, go, busy, openRules }} />
			) : s.phase === 'lobby' ? (
				<Lobby s={s} net={net} openRules={openRules} />
			) : (
				<Game s={s} net={net} openRules={openRules} />
			)}
			{rules && <Rules close={() => setRules(false)} />}
			{err && <div className='toast'>{tr(t, err)}</div>}
		</LangCtx.Provider>
	)
}
