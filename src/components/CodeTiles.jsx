// A room code drawn as game tiles, each character on a paper tile in the four numeral colours (lobby.css .lb-tiles).
// Decorative: callers say the code in words (an aria-label or nearby text).
export const CodeTiles = ({ code }) => (
	<span className='lb-tiles' aria-hidden='true'>
		{[...code].map((c, i) => (
			<span key={i} className='lb-tile'>
				{c}
			</span>
		))}
	</span>
)
