import { CircleCheck, TriangleAlert, Info } from 'lucide-react'
import { tr } from '../i18n/index.js'
import { TopLayer } from './TopLayer.jsx'

export const Toasts = ({ list, t }) => {
	const I = {
		ok: CircleCheck,
		err: TriangleAlert,
		warn: TriangleAlert,
		info: Info,
	}
	// The visible stack is aria-hidden; two always-mounted visually-hidden regions do the announcing (a live region
	// that is display:none until shown is not reliably announced). Errors interrupt (alert), the rest are polite.
	const say = pred => {
		const x = list.findLast(pred)
		return x ? tr(t, x.m) : ''
	}
	return (
		<>
			<div className='sr' role='status'>
				{say(x => x.type !== 'err')}
			</div>
			<div className='sr' role='alert'>
				{say(x => x.type === 'err')}
			</div>
			{list.length > 0 && (
				<TopLayer className='toasts' aria-hidden='true'>
					{list.map(x => {
						const Ic = I[x.type] || Info
						return (
							<div key={x.id} className={'toast ' + x.type}>
								<Ic size={18} />
								<span>{tr(t, x.m)}</span>
							</div>
						)
					})}
				</TopLayer>
			)}
		</>
	)
}
