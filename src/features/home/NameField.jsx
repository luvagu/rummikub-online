import { X } from 'lucide-react'
import { useT } from '../../i18n/index.js'

export function NameField({ name, setName, nameErr, names, onForgetName, onEnter }) {
	const t = useT(),
		recent = names.filter(n => n !== name.trim())
	return (
		<div className='field'>
			{/* the label floats inside the box: centred like a placeholder while empty, at the top once focused or filled */}
			<div className='field-box'>
				<label htmlFor='rmk-name'>{t('name')}</label>
				<input
					id='rmk-name'
					name='nickname'
					placeholder=' ' // a blank placeholder only so CSS can tell an empty field (:placeholder-shown)
					value={name}
					maxLength={16}
					autoComplete='off'
					autoCapitalize='words'
					spellCheck={false}
					enterKeyHint='go'
					aria-invalid={nameErr}
					aria-describedby={nameErr ? 'rmk-name-err' : undefined}
					onChange={e => setName(e.target.value)}
					onKeyDown={e => e.key === 'Enter' && onEnter && onEnter()}
				/>
			</div>
			{nameErr && (
				<small id='rmk-name-err' className='errtxt'>
					{t('needName')}
				</small>
			)}
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
								<X size={12} aria-hidden='true' />
							</button>
						</span>
					))}
				</div>
			)}
		</div>
	)
}
