// A flat strip pinned to the top edge of the installed app (styled only under display-mode: standalone, see components.css).
// iOS 26 draws a progressive "scroll edge" blur over the top of a home-screen web app; WebKit leaves it out only when a
// fixed/sticky, full-width box that paints one solid colour, is more than 10px tall and receives hits sits on that edge.
// The game's header already is one; Home and Lobby render this instead.
export function EdgeCap() {
	return <div className='edgecap' aria-hidden='true' />
}
