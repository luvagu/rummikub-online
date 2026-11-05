// Scripted tutorial: fixed starting positions ("lessons") and the steps that walk through each one.
// Tile id = copy*52 + colour*13 + (number-1); colours: 0 black, 1 red, 2 blue, 3 orange; 104/105 are the jokers.
// (Same layout as DECK in game.js.)
const id = (c, n, copy = 0) => copy * 52 + c * 13 + (n - 1)
export const JOKER = 104
export const RUN = [id(1, 10), id(1, 11), id(1, 12)] // red 10-11-12 = 33 points (first meld needs 30)
export const ADD = id(1, 13) // red 13 extends that run
export const GROUP = [id(0, 5), id(1, 5), JOKER] // black 5 + red 5 + joker = a group of 5s

const BOT_RACK = Array.from({ length: 14 }, (_, i) => 52 + i) // the coach never plays, it only draws

const has = (set, ids) => ids.every(i => set.includes(i))
const tiles = ids => ids.map(i => ['tile', i])
// the + badge of the set that holds tile `i` (only that set's badge is highlighted)
const plusOf = i => ['sel', `.set:has(.tile[data-id="${i}"]) .plus.badge`]

// A step is shown on the player's own turn (other steps show "coach is playing" while it isn't); `next` steps are
// plain info with a Next button. `ok(s, draft)` says the step is done: s = server view, draft = {sel, b, r}, the
// player's unsent edits (selection, board, rack). `hl` lists what to highlight.
const BASICS = [
	{ k: 'welcome', next: true },
	{ k: 'timer', next: true },
	{ k: 'select', hl: tiles(RUN), ok: (s, d) => has(d.sel, RUN) },
	{ k: 'newset', hl: [['tut', 'newset']], ok: (s, d) => d.b.some(x => has(x, RUN)) },
	{ k: 'end', hl: [['tut', 'end']], ok: s => has(s.board.flat(), RUN) },
	{ k: 'add', hl: [['tile', ADD], plusOf(RUN[0])], ok: (s, d) => d.b.some(x => has(x, [RUN[0], ADD])) },
	{ k: 'joker', hl: tiles(GROUP), ok: (s, d) => has(d.sel, GROUP) },
	{ k: 'group', hl: [['tut', 'newset']], ok: (s, d) => d.b.some(x => has(x, GROUP)) },
	{ k: 'end2', hl: [['tut', 'end']], ok: s => s.board.flat().includes(JOKER) },
	{ k: 'draw', hl: [['tut', 'draw']], ok: s => s.rack.length > 7 },
	{ k: 'done', next: true, last: true },
]

// Rearranging: take a tile out of a set on the table to build a new one.
const RUN_BLUE = [id(2, 4), id(2, 5), id(2, 6), id(2, 7)]
const SEVENS = [id(2, 7), id(0, 7), id(1, 7)]
const REARRANGE = [
	{ k: 'rIntro', next: true },
	{ k: 'rSelect', hl: tiles(SEVENS), ok: (s, d) => has(d.sel, SEVENS) },
	{ k: 'rNew', hl: [['tut', 'newset']], ok: (s, d) => d.b.some(x => has(x, SEVENS)) },
	{ k: 'rEnd', hl: [['tut', 'end']], ok: s => s.board.some(x => has(x, SEVENS)) },
	{ k: 'rDone', next: true, last: true },
]

// Joker swap: replace the joker on the table with the real tile, then reuse the joker.
const JB = [id(1, 6), JOKER, id(1, 8)] // red 6, joker (= red 7), red 8
const RED7 = id(1, 7)
const NINES = [id(0, 9), id(2, 9)]
const JOKERSWAP = [
	{ k: 'jIntro', next: true },
	{ k: 'jTake', hl: tiles([JOKER]), ok: (s, d) => d.sel.includes(JOKER) },
	{ k: 'jNew', hl: [['tut', 'newset']], ok: (s, d) => d.b.some(x => x.length === 1 && x[0] === JOKER) },
	{ k: 'jSwap', hl: [['tile', RED7], plusOf(JB[0])], ok: (s, d) => d.b.some(x => has(x, [JB[0], RED7, JB[2]])) },
	{ k: 'jAdd', hl: [...tiles(NINES), plusOf(JOKER)], ok: (s, d) => d.b.some(x => has(x, [JOKER, ...NINES])) },
	{ k: 'jEnd', hl: [['tut', 'end']], ok: s => s.board.some(x => has(x, [JOKER, ...NINES])) },
	{ k: 'jDone', next: true, last: true },
]

// Invalid sets: make a bad one on purpose, see why it is rejected, undo.
const ODD = [id(1, 3), id(2, 9), id(0, 12)]
const INVALID = [
	{ k: 'iIntro', next: true },
	{ k: 'iSelect', hl: tiles(ODD), ok: (s, d) => has(d.sel, ODD) },
	{ k: 'iNew', hl: [['tut', 'newset']], ok: (s, d) => d.b.some(x => has(x, ODD)) },
	{ k: 'iSee', next: true },
	{ k: 'iUndo', hl: [['tut', 'undo']], ok: (s, d) => d.b.length === 0 },
	{ k: 'iDone', next: true, last: true },
]

// Smart play: extend an existing set, keep the joker.
const RUN_BLACK = [id(0, 1), id(0, 2), id(0, 3)]
const B4 = id(0, 4)
const TIPS = [
	{ k: 'tHold', next: true },
	{ k: 'tPoints', next: true },
	{ k: 'tSelect', hl: tiles([B4]), ok: (s, d) => d.sel.includes(B4) },
	{ k: 'tAdd', hl: [plusOf(RUN_BLACK[0])], ok: (s, d) => d.b.some(x => has(x, [...RUN_BLACK, B4])) },
	{ k: 'tEnd', hl: [['tut', 'end']], ok: s => s.board.flat().includes(B4) },
	{ k: 'tWatch', next: true },
	{ k: 'tDone', next: true, last: true },
]

export const LESSONS = {
	basics: {
		melded: false,
		board: [],
		rack: [...RUN, ADD, ...GROUP, id(0, 1), id(2, 3), id(3, 9), id(0, 12), id(2, 8), id(3, 2), id(2, 11)],
		steps: BASICS,
	},
	rearrange: {
		melded: true,
		board: [RUN_BLUE],
		rack: [id(0, 7), id(1, 7), id(0, 1), id(1, 3), id(3, 9), id(0, 12), id(3, 2), id(2, 11), id(3, 13)],
		steps: REARRANGE,
	},
	joker: {
		melded: true,
		board: [JB],
		rack: [RED7, ...NINES, id(0, 1), id(3, 2), id(0, 12), id(2, 11), id(3, 13), id(0, 4)],
		steps: JOKERSWAP,
	},
	invalid: {
		melded: true,
		board: [],
		rack: [...ODD, id(0, 1), id(3, 2), id(2, 11), id(3, 13), id(0, 4), id(3, 7)],
		steps: INVALID,
	},
	tips: {
		melded: true,
		board: [RUN_BLACK],
		rack: [B4, JOKER, id(3, 13), id(3, 9), id(2, 8), id(3, 2), id(2, 11), id(1, 3), id(1, 10)],
		steps: TIPS,
	},
}
export const LESSON_ORDER = ['basics', 'rearrange', 'joker', 'invalid', 'tips']

// Puts an (already joined, bot-added) Game into a lesson's scripted position.
export function setupTutorial(game, botName, lesson = 'basics') {
	const s = game.s,
		L = LESSONS[lesson] || LESSONS.basics,
		used = new Set([...L.rack, ...BOT_RACK, ...L.board.flat()])
	s.players[0].rack = [...L.rack]
	s.players[1].rack = [...BOT_RACK]
	s.players[1].name = botName
	s.players.forEach(p => (p.melded = !!L.melded))
	// the draw pile is popped from the end: the last tiles are what the coach and then the player draw
	s.pool = Array.from({ length: 106 }, (_, i) => i).filter(i => !used.has(i))
	s.board = L.board.map(x => [...x])
	s.turn = 0
	s.phase = 'play'
	s.passes = 0
	s.result = null
	s.log = { k: 'l.starts', p: { name: s.players[0].name } }
	game.bump()
}
