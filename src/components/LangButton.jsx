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
			<Languages size={16} />
			{lang === 'en' ? 'Español' : 'English'}
		</button>
	)
}
