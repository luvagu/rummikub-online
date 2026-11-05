import { useState } from 'react'
import {
	Bot,
	Users,
	KeyRound,
	ChevronRight,
	BookOpen,
	LogOut,
	LoaderCircle,
	X,
	History,
	ArrowLeft,
} from 'lucide-react'
import { COLORS } from './game.js'
import { LESSON_ORDER } from './tutorial.js'
import { useT } from './i18n.js'
import { LangBtn, Modal, Invite } from './ui.jsx'
import { Seats } from './Seats.jsx'

const Logo = () => (
	<div className='logo' aria-label='Rummikub'>
		{'RUMMIKUB'.split('').map((c, i) => (
			<span
				key={i}
				className='ltile'
				style={{ color: COLORS[i % 4], '--i': i }}
			>
				{c}
			</span>
		))}
	</div>
)

function NameField({ name, setName, nameErr, names, onForgetName, onEnter }) {
	const t = useT(),
		recent = names.filter(n => n !== name.trim())
	return (
		<div className='field'>
			<label htmlFor='rmk-name'>{t('name')}</label>
			<input
				id='rmk-name'
				className={nameErr ? 'err' : ''}
				value={name}
				maxLength={16}
				autoComplete='nickname'
				aria-invalid={nameErr}
				onChange={e => setName(e.target.value)}
				onKeyDown={e => e.key === 'Enter' && onEnter && onEnter()}
			/>
			{nameErr && <small className='errtxt'>{t('needName')}</small>}
			{recent.length > 0 && (
				<div className='chips' role='group' aria-label={t('recent')}>
					{recent.map(n => (
						<span key={n} className='nchip'>
							<button onClick={() => setName(n)}>{n}</button>
							<button
								aria-label={t('rmName', { name: n })}
								title={t('rmName', { name: n })}
								onClick={() => onForgetName(n)}
							>
								<X size={12} />
							</button>
						</span>
					))}
				</div>
			)}
		</div>
	)
}

export const getTimed = () => {
	try {
		return localStorage.rmkTimer === '1'
	} catch (e) {
		return false
	}
}
export const getLvl = () => {
	try {
		const n = +localStorage.rmkLvl
		return [1, 2, 3].includes(n) ? n : 2
	} catch (e) {
		return 2
	}
}

export function Home({
	name,
	setName,
	nameErr,
	names,
	onForgetName,
	code,
	setCode,
	start,
	busy,
	cancel,
	saved,
	onResume,
	onForget,
	invite,
	onBack,
	openRules,
}) {
	const t = useT(),
		nf = { name, setName, nameErr, names, onForgetName },
		[pick, setPick] = useState(false),
		[timed, setTimed] = useState(getTimed),
		[mode, setMode] = useState(false),
		[lessons, setLessons] = useState(false) // solo: choose between a bot game and the tutorial
	const playSolo = n => {
		try {
			localStorage.rmkLvl = n
		} catch (e) {}
		setPick(false)
		start('solo')
	}
	// solo needs a name first: let start() show the "name required" error instead of opening the picker
	const soloClick = () => (name.trim() ? setMode(true) : start('solo'))
	const modeModal = mode && (
		<Modal title={t('soloT')} onClose={() => setMode(false)}>
			<h2 className='lvltitle'>{t('soloT')}</h2>
			<div className='lvlopts'>
				<button
					data-autofocus
					onClick={() => {
						setMode(false)
						setPick(true)
					}}
				>
					<span>
						<b>{t('soloBot')}</b>
						<small>{t('soloBotD')}</small>
					</span>
					<ChevronRight size={18} />
				</button>
				<button
					onClick={() => {
						setMode(false)
						setLessons(true)
					}}
				>
					<span>
						<b>{t('soloTut')}</b>
						<small>{t('soloTutD')}</small>
					</span>
					<ChevronRight size={18} />
				</button>
			</div>
		</Modal>
	)
	const lessonsModal = lessons && (
		<Modal title={t('lessonsT')} onClose={() => setLessons(false)}>
			<h2 className='lvltitle'>{t('lessonsT')}</h2>
			<div className='lvlopts'>
				{LESSON_ORDER.map((l, n) => (
					<button
						key={l}
						data-autofocus={n === 0 ? true : undefined}
						onClick={() => {
							setLessons(false)
							start('tutorial', { lesson: l })
						}}
					>
						<span>
							<b>
								{n + 1}. {t('les.' + l)}
							</b>
							<small>{t('les.' + l + 'D')}</small>
						</span>
						<ChevronRight size={18} />
					</button>
				))}
			</div>
		</Modal>
	)
	const lvlModal = pick && (
		<Modal title={t('botLvl')} onClose={() => setPick(false)}>
			<h2 className='lvltitle'>{t('botLvl')}</h2>
			<label className='switch'>
				<input
					type='checkbox'
					checked={timed}
					onChange={e => {
						setTimed(e.target.checked)
						try {
							localStorage.rmkTimer = e.target.checked ? '1' : '0'
						} catch (err) {}
					}}
				/>
				<span className='tr' />
				<span>
					<b>{t('timer')}</b>
					<small>{t('timerD')}</small>
				</span>
			</label>
			<div className='lvlopts'>
				{[1, 2, 3].map(n => (
					<button
						key={n}
						className={n === getLvl() ? 'sel' : ''}
						data-autofocus={n === getLvl() ? true : undefined}
						onClick={() => playSolo(n)}
					>
						<span>
							<b>{t('lvl' + n)}</b>
							<small>{t('lvlD' + n)}</small>
						</span>
						<ChevronRight size={18} />
					</button>
				))}
			</div>
		</Modal>
	)
	const busyModal = busy && (
		<Modal title={t('connecting')}>
			<div className='center'>
				<LoaderCircle className='spin' size={34} />
				<p>{t('busy.' + busy)}</p>
				<button data-autofocus onClick={cancel}>
					{t('cancel')}
				</button>
			</div>
		</Modal>
	)
	if (invite)
		return (
			<main className='home'>
				<LangBtn />
				<Logo />
				<p className='sub'>{t('invited', { code })}</p>
				<div className='codechip small'>
					<span className='codetxt' aria-label={code}>
						{code}
					</span>
				</div>
				<div className='panel'>
					<NameField {...nf} onEnter={() => start('join')} />
					<button className='primary big' onClick={() => start('join')}>
						{t('join')}
					</button>
					<button className='link' onClick={onBack}>
						<ArrowLeft size={16} />
						{t('backStart')}
					</button>
				</div>
				<button className='link' onClick={openRules}>
					<BookOpen size={16} />
					{t('readRules')}
				</button>
				{busyModal}
			</main>
		)
	return (
		<main className='home'>
			<LangBtn />
			<Logo />
			<p className='sub'>{t('sub')}</p>
			{saved && (
				<section className='resume'>
					<History size={22} />
					<div>
						<b>{t('resumeT')}</b>
						<small>
							{t('resumeD', { mode: saved.mode, code: saved.code })}
						</small>
					</div>
					<button className='primary' onClick={onResume}>
						{t('resume')}
					</button>
					<button
						className='icon'
						aria-label={t('forget')}
						title={t('forget')}
						onClick={onForget}
					>
						<X size={18} />
					</button>
				</section>
			)}
			<div className='panel'>
				<NameField {...nf} />
				<button className='opt primary' onClick={soloClick}>
					<Bot size={26} />
					<span>
						<b>{t('solo')}</b>
						<small>{t('soloD')}</small>
					</span>
					<ChevronRight />
				</button>
				<button className='opt' onClick={() => start('host')}>
					<Users size={26} />
					<span>
						<b>{t('create')}</b>
						<small>{t('createD')}</small>
					</span>
					<ChevronRight />
				</button>
				<div className='opt join'>
					<KeyRound size={26} />
					<span>
						<b>{t('joinT')}</b>
						<small>{t('joinD')}</small>
					</span>
					<div className='joinrow'>
						<input
							className='codein'
							value={code}
							maxLength={5}
							placeholder={t('codePh')}
							aria-label={t('code')}
							autoCapitalize='characters'
							autoComplete='off'
							onChange={e =>
								setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))
							}
							onKeyDown={e =>
								e.key === 'Enter' && code.length === 5 && start('join')
							}
						/>
						<button
							className='primary'
							disabled={code.length < 5}
							onClick={() => start('join')}
						>
							{t('join')}
						</button>
					</div>
				</div>
			</div>
			<button className='link' onClick={openRules}>
				<BookOpen size={16} />
				{t('readRules')}
			</button>
			{busyModal}
			{lvlModal}
			{modeModal}
			{lessonsModal}
		</main>
	)
}

export function Lobby({ s, net, copy, share, leave, openRules }) {
	const t = useT(),
		host = s.me === 0
	return (
		<main className='home lobby'>
			<LangBtn />
			<p className='sub'>{t('room')}</p>
			<Invite net={net} copy={copy} share={share} />
			<Seats s={s} net={net} host={host} />
			{host ? (
				<>
					<label className='switch'>
						<input
							type='checkbox'
							checked={s.opts.timer}
							onChange={e => net.send({ t: 'opts', timer: e.target.checked })}
						/>
						<span className='tr' />
						<span>
							<b>{t('timer')}</b>
							<small>{t('timerD')}</small>
						</span>
					</label>
					<button
						className='primary big'
						disabled={s.players.length < 2}
						onClick={() => net.send({ t: 'start' })}
					>
						{t('start', { n: s.players.length })}
					</button>
					<p className='sub'>{s.players.length < 2 ? t('need2') : t('keep')}</p>
				</>
			) : (
				<p className='waitp'>
					<LoaderCircle className='spin' size={18} />
					{t('waitHost')}
				</p>
			)}
			<div className='row'>
				<button className='link' onClick={openRules}>
					<BookOpen size={16} />
					{t('readRules')}
				</button>
				<button className='link' onClick={leave}>
					<LogOut size={16} />
					{t('leave')}
				</button>
			</div>
		</main>
	)
}
