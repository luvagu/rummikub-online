import { createRoot } from 'react-dom/client'
import '@fontsource-variable/outfit'
import '@fontsource-variable/inter'
import App from './App.jsx'
import { ErrorBoundary } from './components/ErrorBoundary.jsx'
import { registerSW } from './services/sw-update.js'
import './styles/index.css'

registerSW()
createRoot(document.getElementById('root')).render(
	<ErrorBoundary>
		<App />
	</ErrorBoundary>,
)
