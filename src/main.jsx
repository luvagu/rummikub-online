import { Component } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/outfit'
import '@fontsource-variable/inter'
import App from './App.jsx'
import { local, session } from './store.js'
import './styles.css'

const wipe = () => {
	// a corrupt saved game/session must never lock the player out: drop all saved state
	for (const k of ['rmkHost', 'rmkSolo', 'rmkSess']) {
		local.remove(k)
		session.remove(k)
	}
}

class ErrorBoundary extends Component {
	state = { err: null }
	static getDerivedStateFromError(err) {
		return { err }
	}
	componentDidCatch(err, info) {
		console.error(err, info?.componentStack) // the crash is reported, then saved state is dropped so it cannot lock the player out
		wipe()
	}
	render() {
		if (!this.state.err) return this.props.children
		return (
			<div
				style={{
					minHeight: '100dvh',
					display: 'grid',
					placeItems: 'center',
					textAlign: 'center',
					padding: 24,
					color: '#fff',
					font: '16px system-ui, sans-serif',
				}}
			>
				<div>
					<h2>Something went wrong / Algo salió mal</h2>
					<p>Your saved game was reset. / Se reinició la partida guardada.</p>
					<button
						style={{ padding: '12px 20px', fontSize: 16 }}
						onClick={() => location.reload()}
					>
						Reload / Recargar
					</button>
				</div>
			</div>
		)
	}
}

createRoot(document.getElementById('root')).render(
	<ErrorBoundary>
		<App />
	</ErrorBoundary>,
)
