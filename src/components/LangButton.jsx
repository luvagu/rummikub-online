import { useContext } from 'react'
import { Languages } from 'lucide-react'
import { LangCtx } from '../i18n/index.js'

export const LangButton = () => {
	const { lang, setLang } = useContext(LangCtx)
	return (
		<button
			className='lang'
			// the accessible name must contain the visible text (WCAG 2.5.3 Label in Name)
			aria-label={`${lang === 'en' ? 'Español' : 'English'} – Language / Idioma`}
			onClick={() => setLang(lang === 'en' ? 'es' : 'en')}
		>
			<Languages size={16} aria-hidden='true' />
			{/* long on wide layouts, the ISO code on phones (the containers' CSS picks one) */}
			<span className='lang-long'>{lang === 'en' ? 'Español' : 'English'}</span>
			<span className='lang-short' aria-hidden='true'>
				{lang === 'en' ? 'ES' : 'EN'}
			</span>
		</button>
	)
}
