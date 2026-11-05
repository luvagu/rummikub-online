import { useState } from 'react'
import {
	Bot,
	Users,
	KeyRound,
	ChevronRight,
	BookOpen,
	Crown,
	LogOut,
	Link2,
	Share2,
	Copy,
	Check,
	LoaderCircle,
	WifiOff,
	X,
	Plus,
	History,
	ArrowLeft,
} from 'lucide-react'
import { COLORS } from './game.js'
import { useT } from './i18n.js'
import { Avatar, LangBtn, Modal } from './ui.jsx'

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

export const getLvl = () => {
	try {
		const n = +localStorage.rmkLvl
		return [1, 2, 3].includes(n) ? n : 2
	} catch (e) {
		return 2
	}
}

function LevelPicker({ value, onChange, label }) {
	const t = useT()
	return (
		<div className='field lvlpick' role='group' aria-label={label}>
			<span>{label}</span>
			<div className='seg lvlseg'>
				{[1, 2, 3].map(n => (
					<button
						key={n}
						aria-pressed={value === n}
						onClick={() => onChange(n)}
					>
						{t('lvl' + n)}
					</button>
				))}
			</div>
			<small className='lvld'>{t('lvlD' + value)}</small>
		</div>
	)
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
		[lvl, setLvl] = useState(getLvl)
	const pickLvl = n => {
		setLvl(n)
		try {
			localStorage.rmkLvl = n
		} catch (e) {}
	}
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
				<LevelPicker value={lvl} onChange={pickLvl} label={t('botLvl')} />
				<button className='opt primary' onClick={() => start('solo')}>
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
		</main>
	)
}

export function Lobby({ s, net, copy, share, leave, openRules }) {
	const t = useT(),
		host = s.me === 0,
		[done, setDone] = useState('')
	const doCopy = async w => {
		if (await copy(w)) {
			setDone(w)
			setTimeout(() => setDone(''), 1800)
		}
	}
	const lastBot = s.players.map(p => !!p.bot).lastIndexOf(true)
	return (
		<main className='home lobby'>
			<LangBtn />
			<p className='sub'>{t('room')}</p>
			<div className='codechip'>
				<span className='codetxt' aria-label={net.code}>
					{net.code}
				</span>
				<button
					className='icon'
					aria-label={t('copyCode')}
					title={t('copyCode')}
					onClick={() => doCopy('code')}
				>
					{done === 'code' ? <Check size={20} /> : <Copy size={20} />}
				</button>
			</div>
			<div className='row'>
				<button className='primary' onClick={() => doCopy('link')}>
					{done === 'link' ? <Check size={18} /> : <Link2 size={18} />}
					{done === 'link' ? t('copied') : t('copy')}
				</button>
				{navigator.share && (
					<button onClick={share}>
						<Share2 size={18} />
						{t('share')}
					</button>
				)}
			</div>
			<p className='sub'>{t('inviteHint')}</p>
			<ul className='lseats'>
				{[0, 1, 2, 3].map(i => {
					const p = s.players[i]
					return p ? (
						<li key={p.id} className={'lseat' + (p.on === false ? ' off' : '')}>
							<Avatar name={p.name} i={i} />
							<b>
								{p.name}
								{i === s.me && <em> {t('you')}</em>}
							</b>
							{i === 0 && <Crown size={16} aria-label={t('host')} />}
							{p.bot && <Bot size={16} aria-label={t('bot')} />}
							{p.bot && !p.left && (
								<small className='lvltag'>{t('lvl' + (p.lvl || 2))}</small>
							)}
							{p.on === false && <WifiOff size={16} aria-label={t('off')} />}
							{host && p.bot && i === lastBot && (
								<button
									className='icon'
									aria-label={t('rmBot')}
									title={t('rmBot')}
									onClick={() => net.send({ t: 'unbot' })}
								>
									<X size={16} />
								</button>
							)}
						</li>
					) : (
						<li key={'e' + i} className='lseat empty'>
							<span className='av ghost' />
							<span>{t('waiting')}</span>
							{host && i === s.players.length && (
								<button onClick={() => net.send({ t: 'bot' })}>
									<Plus size={16} />
									<Bot size={16} />
									{t('addBot')}
								</button>
							)}
						</li>
					)
				})}
			</ul>
			{host ? (
				<>
					{s.players.length < 4 && (
						<LevelPicker
							value={s.opts.lvl || 2}
							onChange={n => net.send({ t: 'opts', lvl: n })}
							label={t('botLvlNext')}
						/>
					)}
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
