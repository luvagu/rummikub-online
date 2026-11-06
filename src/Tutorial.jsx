import { useState, useEffect } from 'react'
import {
	GraduationCap,
	X,
	ChevronRight,
	BookOpen,
	Bot,
	House,
	ListChecks,
} from 'lucide-react'
import { useT } from './i18n.js'
import { LESSONS, LESSON_ORDER } from './tutorial.js'

const sel = ([kind, v]) =>
	kind === 'tile'
		? `.tile[data-id="${v}"]`
		: kind === 'tut'
			? `[data-tut="${v}"]`
			: v

// Guided-lesson overlay on top of the normal table: a coach card (non-modal, so the table stays usable) that
// highlights what to tap next and moves on by itself once the player has done it.
export default function Tutorial({
	s,
	draft,
	lesson = 'basics',
	onExit,
	onRules,
	onPlay,
	onFinish,
	onNext,
}) {
	const t = useT(),
		STEPS = (LESSONS[lesson] || LESSONS.basics).steps,
		nextL = LESSON_ORDER[LESSON_ORDER.indexOf(lesson) + 1],
		[i, setI] = useState(0),
		step = STEPS[i],
		mine = s.turn === s.me

	useEffect(() => {
		if (step.ok && step.ok(s, draft))
			setI(n => Math.min(n + 1, STEPS.length - 1))
	}, [s, draft, step, STEPS.length])

	useEffect(() => {
		if (!mine || !step.hl) return
		const q = step.hl.map(sel).join(','),
			mark = () =>
				document.querySelectorAll(q).forEach(el => el.classList.add('tut-hl'))
		mark()
		const iv = setInterval(mark, 250) // React rewrites className on re-render, so keep re-applying
		return () => {
			clearInterval(iv)
			document
				.querySelectorAll('.tut-hl')
				.forEach(el => el.classList.remove('tut-hl'))
		}
	}, [step, mine, s, draft])

	const showWait = !mine && !step.next
	return (
		<aside className='coach' role='status' aria-live='polite'>
			<div className='coachhead'>
				<GraduationCap size={18} />
				<b>{showWait ? t('tut.wait.t') : t('tut.' + step.k + '.t')}</b>
				<span className='coachn'>
					{i + 1}/{STEPS.length}
				</span>
				<button
					className='icon'
					aria-label={t('tut.exit')}
					title={t('tut.exit')}
					onClick={onExit}
				>
					<X size={16} />
				</button>
			</div>
			<p>{showWait ? t('tut.wait.b') : t('tut.' + step.k + '.b')}</p>
			<div className='row'>
				{step.last ? (
					<>
						{nextL && (
							<button
								className='primary'
								data-autofocus
								onClick={() => onNext(nextL)}
							>
								<ListChecks size={16} />
								{t('tut.nextLesson')}
							</button>
						)}
						<button className={nextL ? '' : 'primary'} onClick={onPlay}>
							<Bot size={16} />
							{t('tut.play')}
						</button>
						<button onClick={onRules}>
							<BookOpen size={16} />
							{t('readRules')}
						</button>
						<button onClick={onFinish}>
							<House size={16} />
							{t('tut.home')}
						</button>
					</>
				) : step.next ? (
					<button
						className='primary'
						data-autofocus
						onClick={() => setI(n => n + 1)}
					>
						{t('tut.next')}
						<ChevronRight size={16} />
					</button>
				) : (
					<button
						className='link'
						onClick={() => setI(n => Math.min(n + 1, STEPS.length - 1))}
					>
						{t('tut.skip')}
					</button>
				)}
			</div>
		</aside>
	)
}
