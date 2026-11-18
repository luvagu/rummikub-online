import { useState } from 'react'
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
} from 'lucide-react'
import { LESSON_ORDER } from '../../engine/tutorial.js'
import { useT } from '../../i18n/index.js'
import { LangButton } from '../../components/LangButton.jsx'
import { Modal } from '../../components/Modal.jsx'
import { local } from '../../utils/store.js'
import { Logo } from './Logo.jsx'
import { NameField } from './NameField.jsx'
import { TimerPick } from '../../components/TimerPick.jsx'
import { getTimer, getLvl } from './preferences.js'

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
		[timed, setTimed] = useState(getTimer),
		[mode, setMode] = useState(false),
		[lessons, setLessons] = useState(false) // solo: choose between a bot game and the tutorial
	const playSolo = n => {
		local.set('rmkLvl5', n)
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
			<TimerPick
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
				<LangButton />
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
			<LangButton />
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
							id='rmk-code'
							name='room-code'
							value={code}
							maxLength={5}
							placeholder={t('codePh')}
							aria-label={t('code')}
							autoCapitalize='characters'
							autoComplete='off'
							autoCorrect='off'
							spellCheck={false}
							enterKeyHint='go'
							onPaste={e => {
								// a pasted invite link (…/#ABCDE) or a code inside other text: take the code, not the first 5 characters
								const txt = e.clipboardData.getData('text'),
									m = /#([A-Za-z0-9]{5})\b/.exec(txt) || /\b([A-Za-z0-9]{5})\b/.exec(txt)
								if (m) {
									e.preventDefault()
									setCode(m[1].toUpperCase())
								}
							}}
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
