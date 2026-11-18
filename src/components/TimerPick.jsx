import { TIMES } from '../engine/game.js'
import { useT } from '../i18n/index.js'

export function TimerPick({ value, onChange }) {
	const t = useT()
	return (
		<div className='timerpick'>
			<span>
				<b>{t('timer')}</b>
				<small>{t('timerD')}</small>
			</span>
			<div className='seg' role='radiogroup' aria-label={t('timer')}>
				{TIMES.map(n => (
					<button
						key={n}
						role='radio'
						aria-checked={n === value}
						className={n === value ? 'primary' : ''}
						onClick={() => onChange(n)}
					>
						{n ? n + 's' : t('timerOff')}
					</button>
				))}
			</div>
		</div>
	)
}
