import { useId, useLayoutEffect, useRef } from 'react'
import { Check, TriangleAlert } from 'lucide-react'

// A unique anchor name for a copy button (CSS anchor positioning), from React's id.
export const useAnchorName = () => '--cb' + useId().replace(/[^\w-]/g, '')

// "Copied" / "Couldn't copy" in a small bubble on the copy button, instead of a toast across the screen that covered the
// very code that was copied. A manual popover anchored to the button (surfaces.css: .cbubble; without anchor positioning
// it sits at the bottom of the screen). Decorative: the app's live region announces the result (App.jsx copy()).
// `state`: '' (hidden), 'ok' or 'err'.
export function CopyBubble({ anchor, state, t }) {
	const ref = useRef(),
		last = useRef('ok')
	if (state) last.current = state // keep the text while it fades out
	useLayoutEffect(() => {
		const el = ref.current,
			open = el.matches(':popover-open')
		if (state && !open) el.showPopover()
		else if (!state && open) el.hidePopover()
	}, [state])
	const err = last.current === 'err'
	return (
		<span
			ref={ref}
			popover='manual'
			className='cbubble'
			data-tone={err ? 'err' : undefined}
			style={{ positionAnchor: anchor }}
			aria-hidden='true'
		>
			{err ? <TriangleAlert size={15} /> : <Check size={15} />}
			{err ? t('copyFailS') : t('copied')}
		</span>
	)
}
