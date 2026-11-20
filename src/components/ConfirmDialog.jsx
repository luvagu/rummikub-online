import { Modal, useModal } from './Modal.jsx'

// A yes/no question before something that cannot be undone (leaving, ending the round). A small dialog with an icon
// badge, on phones a bottom sheet with full-width buttons. The safe answer is focused and comes last in the DOM, which
// puts it nearest the thumb on a sheet. No close button: the safe answer is the way out (Escape and a tap outside too).
function Actions({ cancel, confirm, onCancel, onConfirm, tone }) {
	const { close } = useModal()
	return (
		<>
			<button className={'primary' + (tone === 'danger' ? ' danger' : '')} onClick={onConfirm}>
				{confirm}
			</button>
			<button data-autofocus onClick={() => close(onCancel)}>
				{cancel}
			</button>
		</>
	)
}

export function ConfirmDialog({ title, body, icon, cancel, confirm, onCancel, onConfirm, tone = 'danger' }) {
	return (
		<Modal
			title={title}
			icon={icon}
			tone={tone}
			size='sm'
			onClose={onCancel}
			closeButton={false}
			footer={<Actions {...{ cancel, confirm, onCancel, onConfirm, tone }} />}
		>
			<p>{body}</p>
		</Modal>
	)
}
