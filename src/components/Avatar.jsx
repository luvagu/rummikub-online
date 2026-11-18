const AV = ['#ffb300', '#81c784', '#4fc3f7', '#f48fb1']
export const Avatar = ({ name, i, badge }) => (
	<span className='av' style={{ background: AV[i % 4] }} aria-hidden='true'>
		{(name || '?').trim().charAt(0).toUpperCase()}
		{badge != null && <span className='bd'>{badge}</span>}
	</span>
)
