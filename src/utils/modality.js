// How the player last interacted: keyboard or pointer. A dialog or menu opened by a tap or a click moves focus inside
// without the keyboard focus ring (it read as a stray highlight on touch); opened from the keyboard, the ring shows.
// `focusVisible` is a newer focus() option: where it is unsupported, the browser's own heuristic applies as before.
let keyboard = false
addEventListener(
	'keydown',
	e => {
		if (!e.metaKey && !e.ctrlKey && !e.altKey) keyboard = true
	},
	true,
)
addEventListener('pointerdown', () => (keyboard = false), true)

export const lastInputWasKeyboard = () => keyboard
// focus an element the way the last input deserves
export const focusForInput = el => el?.focus({ preventScroll: true, focusVisible: keyboard })
