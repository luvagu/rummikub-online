import { Component } from 'react'
import { local, session } from '../utils/store.js'

// Last-resort screen for a render error. The crash is logged, then saved games are dropped so a corrupt one cannot lock the
// player out; the page itself is plain markup with a few base.css rules, so it does not depend on anything that may have failed.
const wipe = () => {
	// a corrupt saved game/session must never lock the player out: drop all saved state
	for (const k of ['rmkHost', 'rmkSolo', 'rmkSess']) {
		local.remove(k)
		session.remove(k)
	}
}

export class ErrorBoundary extends Component {
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
		// plain markup with its own small stylesheet rules (base.css .crash): nothing here may depend on what failed
		return (
			<main className='crash'>
				<div className='crash-card'>
					<h2>Something went wrong / Algo salió mal</h2>
					<p>Your saved game was reset. / Se reinició la partida guardada.</p>
					<button className='crash-btn' onClick={() => location.reload()}>
						Reload / Recargar
					</button>
				</div>
			</main>
		)
	}
}
