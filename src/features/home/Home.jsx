import { useState, useEffect } from 'react'
import {
	Bot,
	Users,
	KeyRound,
	ChevronRight,
	BookOpen,
	LoaderCircle,
	X,
	History,
	ArrowLeft,
	ArrowRight,
	GraduationCap,
	UserRoundCheck,
	WifiOff,
} from 'lucide-react'
import { LESSON_ORDER } from '../../engine/tutorial.js'
import { useT } from '../../i18n/index.js'
import { LangButton } from '../../components/LangButton.jsx'
import { Modal } from '../../components/Modal.jsx'
import { local } from '../../utils/store.js'
import { Logo } from './Logo.jsx'
import { NameField } from './NameField.jsx'
import { LobbyTimer } from '../lobby/LobbyTimer.jsx'
import { CodeTiles } from '../../components/CodeTiles.jsx'
import { getTimer, getLvl } from './preferences.js'
import { focusForInput } from '../../utils/modality.js'

// A pasted invite link (…/#ABCDE) or a code inside other text: take the code, not the first 5 characters.
const codeFromPaste = txt => (/#([A-Za-z0-9]{5})\b/.exec(txt) || /\b([A-Za-z0-9]{5})\b/.exec(txt))?.[1]

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
		[timed, setTimed] = useState(getTimer),
		// solo setup, one dialog in steps: 'mode' (bot game or tutorial) → 'bot' (difficulty) or 'lessons'
		[step, setStep] = useState(null),
		[dir, setDir] = useState('fwd'),
		go = (to, d = 'fwd') => {
			setDir(d)
			setStep(to)
		}
	// a new step replaces the focused button: move focus to the step's own starting point (Modal does it on open)
	useEffect(() => {
		if (step) focusForInput(document.querySelector('dialog[open] .sf-step [data-autofocus]'))
	}, [step])
	const playSolo = n => {
		local.set('rmkLvl5', n)
		setStep(null)
		start('solo')
	}
	// solo needs a name first: let start() show the "name required" error instead of opening the picker
	const soloClick = () => (name.trim() ? go('mode') : start('solo'))
	// a real <form>: Enter on a desktop keyboard and "Go" on a phone keyboard both submit natively
	const submitJoin = e => {
		e.preventDefault()
		if (invite || code.length === 5) start('join')
	}

	const modeStep = (
		<div className='lvlopts'>
			<button data-autofocus onClick={() => go('bot')}>
				<span className='lv-ico' aria-hidden='true'>
					<Bot size={22} />
				</span>
				<span className='lv-txt'>
					<b>{t('soloBot')}</b>
					<small>{t('soloBotD')}</small>
				</span>
				<ChevronRight size={18} aria-hidden='true' />
			</button>
			<button onClick={() => go('lessons')}>
				<span className='lv-ico' aria-hidden='true'>
					<GraduationCap size={22} />
				</span>
				<span className='lv-txt'>
					<b>{t('soloTut')}</b>
					<small>{t('soloTutD')}</small>
				</span>
				<ChevronRight size={18} aria-hidden='true' />
			</button>
		</div>
	)
	const lessonsStep = (
		<div className='lvlopts'>
			{LESSON_ORDER.map((l, n) => (
				<button
					key={l}
					data-autofocus={n === 0 ? true : undefined}
					onClick={() => {
						setStep(null)
						start('tutorial', { lesson: l })
					}}
				>
					{/* the number stays in the accessible name: "1 The basics" */}
					<span className='lv-num'>{n + 1}</span>
					<span className='lv-txt'>
						<b>{t('les.' + l)}</b>
						<small>{t('les.' + l + 'D')}</small>
					</span>
					<ChevronRight size={18} aria-hidden='true' />
				</button>
			))}
		</div>
	)
	const botStep = (
		<>
			{/* the lobby's timer control, without its panel chrome: one segmented control across the app */}
			<LobbyTimer
				bare
				host
				value={timed}
				onChange={n => {
					setTimed(n)
					local.set('rmkTimer', n)
				}}
			/>
			<div className='lvlopts'>
				{[1, 2, 3, 4, 5].map(n => (
					<button
						key={n}
						className={n === getLvl() ? 'sel' : ''}
						data-autofocus={n === getLvl() ? true : undefined}
						onClick={() => playSolo(n)}
					>
						<span className='lv-txt'>
							<b>{t('lvl' + n)}</b>
							<small>{t('lvlD' + n)}</small>
						</span>
						{/* difficulty at a glance; the level name already says it in words */}
						<span className='lv-pips' aria-hidden='true'>
							{[1, 2, 3, 4, 5].map(k => (
								<i key={k} className={k <= n ? 'on' : undefined} />
							))}
						</span>
						<ChevronRight size={18} aria-hidden='true' />
					</button>
				))}
			</div>
		</>
	)
	// one dialog for the whole solo setup: the steps slide in place (a Back button returns to the first one), instead of
	// one modal closing and another opening
	const soloModal = step && (
		<Modal
			title={t(step === 'bot' ? 'botLvl' : step === 'lessons' ? 'lessonsT' : 'soloT')}
			onClose={() => setStep(null)}
			onBack={step === 'mode' ? undefined : () => go('mode', 'back')}
		>
			<div key={step} className='sf-step' data-dir={dir}>
				{step === 'bot' ? botStep : step === 'lessons' ? lessonsStep : modeStep}
			</div>
		</Modal>
	)
	const busyModal = busy && (
		<Modal title={t('connecting')} bare size='sm'>
			<div className='sf-stack'>
				<LoaderCircle className='spin' size={34} aria-hidden='true' />
				<p>{t('busy.' + busy)}</p>
				<button data-autofocus onClick={cancel}>
					{t('cancel')}
				</button>
			</div>
		</Modal>
	)

	const bar = (
		<header className='hm-bar'>
			<button className='hm-ghost hm-rules' onClick={openRules} aria-label={t('readRules')} title={t('readRules')}>
				<BookOpen size={16} aria-hidden='true' />
				<span className='rules-long'>{t('readRules')}</span>
				<span className='rules-short' aria-hidden='true'>
					{t('readRulesShort')}
				</span>
			</button>
			<LangButton />
		</header>
	)

	if (invite)
		return (
			<main className='home'>
				{bar}
				<div className='hm-shell'>
					<section className='hm-hero'>
						<Logo />
						<p className='hm-tagline'>{t('invited', { code })}</p>
						{/* the code on tiles, as in the lobby; the tagline above already says it in words */}
						<span className='lb-code hm-code'>
							<CodeTiles code={code} />
						</span>
					</section>
					<section className='hm-panel'>
						<form className='hm-stack' onSubmit={submitJoin}>
							<NameField {...nf} />
							<button type='submit' className='hm-cta'>
								<span className='hm-txt'>
									<b>{t('join')}</b>
								</span>
								<ArrowRight className='hm-chev' aria-hidden='true' />
							</button>
						</form>
						<button className='hm-link' onClick={onBack}>
							<ArrowLeft size={16} aria-hidden='true' />
							{t('backStart')}
						</button>
					</section>
				</div>
				{busyModal}
			</main>
		)

	return (
		<main className='home'>
			{bar}
			<div className='hm-shell'>
				<section className='hm-hero'>
					<Logo />
					<p className='hm-tagline'>{t('sub')}</p>
					<ul className='hm-feats'>
						<li>
							<Bot size={18} aria-hidden='true' />
							{t('featBots')}
						</li>
						<li>
							<UserRoundCheck size={18} aria-hidden='true' />
							{t('featNoSignup')}
						</li>
						<li>
							<WifiOff size={18} aria-hidden='true' />
							{t('featOffline')}
						</li>
					</ul>
				</section>
				<section className='hm-panel'>
					{saved && (
						<div className='hm-resume' role='group' aria-label={t('resumeT')}>
							<History size={22} aria-hidden='true' />
							<div className='hm-txt'>
								<b>{t('resumeT')}</b>
								<small>{t('resumeD', { mode: saved.mode, code: saved.code })}</small>
							</div>
							<button className='primary' onClick={onResume}>
								{t('resume')}
							</button>
							<button className='icon' aria-label={t('forget')} title={t('forget')} onClick={onForget}>
								<X size={18} aria-hidden='true' />
							</button>
						</div>
					)}
					<NameField {...nf} />
					<button className='hm-cta' onClick={soloClick}>
						<span className='hm-ico' aria-hidden='true'>
							<Bot size={24} />
						</span>
						<span className='hm-txt'>
							<b>{t('solo')}</b>
							<small>{t('soloD')}</small>
						</span>
						<ChevronRight className='hm-chev' aria-hidden='true' />
					</button>
					<p className='hm-divider'>{t('orOnline')}</p>
					<button className='hm-opt' onClick={() => start('host')}>
						<span className='hm-ico' aria-hidden='true'>
							<Users size={22} />
						</span>
						<span className='hm-txt'>
							<b>{t('create')}</b>
							<small>{t('createD')}</small>
						</span>
						<ChevronRight className='hm-chev' aria-hidden='true' />
					</button>
					<form className='hm-opt hm-join' onSubmit={submitJoin} noValidate>
						<span className='hm-ico' aria-hidden='true'>
							<KeyRound size={22} />
						</span>
						<span className='hm-txt'>
							<b>{t('joinT')}</b>
							<small id='rmk-code-hint'>{t('joinD')}</small>
						</span>
						<div className='hm-joinrow'>
							<input
								className='codein'
								id='rmk-code'
								name='room-code'
								value={code}
								maxLength={5}
								pattern='[A-Z0-9]{5}'
								placeholder={t('codePh')}
								aria-label={t('code')}
								aria-describedby='rmk-code-hint'
								autoCapitalize='characters'
								autoComplete='off'
								autoCorrect='off'
								spellCheck={false}
								enterKeyHint='go'
								onPaste={e => {
									const c = codeFromPaste(e.clipboardData.getData('text'))
									if (c) {
										e.preventDefault()
										setCode(c.toUpperCase())
									}
								}}
								onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
							/>
							<button type='submit' className='primary' disabled={code.length < 5}>
								{t('join')}
							</button>
						</div>
					</form>
				</section>
			</div>
			{busyModal}
			{soloModal}
		</main>
	)
}
