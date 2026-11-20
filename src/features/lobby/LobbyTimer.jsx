import { useId } from 'react'
import { TIMES } from '../../engine/game.js'
import { useT } from '../../i18n/index.js'

// Turn timer as a native radio group (arrow keys, form semantics) drawn as a segmented control.
// Guests get the same control disabled, so everyone sees the rules the game will be played under.
// The lobby shows it as a panel; the solo setup dialog uses it `bare` (no panel chrome).
export function LobbyTimer({ value, onChange, host, bare }) {
	const t = useT(),
		h = useId(),
		d = useId(),
		name = useId()
	return (
		<section className={'lb-panel lb-timer' + (bare ? ' bare' : '')} aria-labelledby={h}>
			<h2 id={h} className='lb-eyebrow'>
				{t('timer')}
			</h2>
			<div className='lb-seg' role='radiogroup' aria-labelledby={h} aria-describedby={d}>
				{TIMES.map(n => (
					<label key={n}>
						<input
							type='radio'
							name={name}
							value={n}
							checked={n === value}
							disabled={!host}
							onChange={() => onChange(n)}
						/>
						<span>{n ? n + 's' : t('timerOff')}</span>
					</label>
				))}
			</div>
			<p id={d} className='lb-hint'>
				{t('timerD')}
			</p>
		</section>
	)
}
