import { TIMES } from '../../engine/game.js'
import { local } from '../../utils/store.js'

export const getTimer = () => {
	const v = local.get('rmkTimer')
	if (v == null) return 45
	const n = +v
	return n === 1 ? 60 : TIMES.includes(n) ? n : 0
}

export const getLvl = () => {
	const n = +local.get('rmkLvl5')
	return [1, 2, 3, 4, 5].includes(n) ? n : 3
}
