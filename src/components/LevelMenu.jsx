import { useState, useId } from 'react'
import { Bot, ChevronDown, Check } from 'lucide-react'
import { useT } from '../i18n/index.js'
import { Popup, hidePopup } from './Popup.jsx'

// Bot difficulty picker: a button that opens a listbox popover (a bottom sheet on phones, surfaces.css). Used on the open
// seat of the room's seat list (LobbySeats), in the lobby and between rounds.
export function LevelMenu({ value, onChange, label, className = '' }) {
	const t = useT(),
		id = useId(),
		[open, setOpen] = useState(false)
	return (
		<div className={'menuwrap lvlmenu ' + className}>
			<button
				className='lvlbtn'
				aria-haspopup='listbox'
				aria-expanded={open}
				aria-label={label}
				title={label}
				command='toggle-popover'
				commandfor={id}
			>
				<Bot size={16} />
				<span>{t('lvl' + value)}</span>
				<ChevronDown size={16} />
			</button>
			<Popup id={id} className='menu lvlpop' role='listbox' label={label} onOpenChange={setOpen}>
				{[1, 2, 3, 4, 5].map(n => (
					<button
						key={n}
						role='option'
						aria-selected={value === n}
						onClick={() => {
							onChange(n)
							hidePopup(id)
						}}
					>
						<span>
							<b>{t('lvl' + n)}</b>
							<small>{t('lvlD' + n)}</small>
						</span>
						{value === n && <Check size={16} />}
					</button>
				))}
			</Popup>
		</div>
	)
}
