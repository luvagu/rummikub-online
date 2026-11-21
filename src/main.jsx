import { createRoot } from 'react-dom/client'
import '@fontsource-variable/outfit'
import '@fontsource-variable/inter'
import App from './App.jsx'
import { ErrorBoundary } from './components/ErrorBoundary.jsx'
import { registerSW } from './services/sw-update.js'
import { loadTable, applyTable, DEFAULT_TABLE } from './features/game/tableTheme.js'
import './styles/index.css'

registerSW()
{
	const t = loadTable() // index.html already set data-table before first paint; this brings the browser's theme-color in line with it
	if (t !== DEFAULT_TABLE) applyTable(t)
}
createRoot(document.getElementById('root')).render(
	<ErrorBoundary>
		<App />
	</ErrorBoundary>,
)
