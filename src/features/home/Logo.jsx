import { COLORS } from '../../engine/game.js'

// The page heading: one accessible name, with the decorative tiles hidden so it is not read letter by letter.
export const Logo = () => (
	<h1 className='logo'>
		<span className='sr'>Rummikub</span>
		{'RUMMIKUB'.split('').map((c, i) => (
			<span
				key={i}
				className='ltile'
				aria-hidden='true'
				style={{ color: COLORS[i % 4], '--i': i }}
			>
				{c}
			</span>
		))}
	</h1>
)
