// Bot-vs-bot simulation: node scripts/bot-sim.mjs [games=30] [maxTurns=150]
// Seats levels against each other and prints win rates + avg move time per level.
import { Game } from '../src/game.js'

const games = +process.argv[2] || 30,
	maxTurns = +process.argv[3] || 150,
	lv = [1, 3, 4, 5]
const wins = Object.fromEntries(lv.map(l => [l, 0])),
	ms = Object.fromEntries(lv.map(l => [l, { t: 0, n: 0 }])),
	left = Object.fromEntries(lv.map(l => [l, 0]))
let draws = 0
for (let g = 0; g < games; g++) {
	const game = new Game()
	game.join('h', 'Host')
	game.s.players = []
	game.s.scores = {}
	game.s.wins = {}
	game.s.opts.timer = 0
	const order = [...lv].sort(() => Math.random() - 0.5)
	order.forEach((l, i) => {
		game.s.players.push({ id: 'b' + l, name: 'L' + l, bot: true, lvl: l, rack: [], melded: false, on: true })
		game.s.scores['b' + l] = 0
		game.s.wins['b' + l] = 0
	})
	game.s.games = g
	game.deal()
	let turns = 0
	while (game.s.phase === 'play' && turns++ < maxTurns * lv.length) {
		const p = game.s.players[game.s.turn],
			t0 = performance.now()
		game.botPlay()
		const e = ms[p.lvl]
		e.t += performance.now() - t0
		e.n++
	}
	if (game.s.phase === 'over' && game.s.result && !game.s.result.cancelled)
		wins[game.s.players[game.s.result.winner].lvl]++
	else draws++
	game.s.players.forEach(p => (left[p.lvl] += p.rack.length))
}
console.log(`games=${games} unfinished=${draws}`)
for (const l of lv)
	console.log(
		`lvl ${l}: wins ${wins[l]} (${((100 * wins[l]) / games).toFixed(0)}%)  avg tiles left ${(left[l] / games).toFixed(1)}  avg move ${(ms[l].t / Math.max(1, ms[l].n)).toFixed(1)}ms`,
	)
