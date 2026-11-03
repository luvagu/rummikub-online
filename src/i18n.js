import { createContext, useContext } from 'react'
// Messages from the game engine/network are {k,p} objects so each player sees them in their own language.
export const D = {
	en: {
		sub: 'Play with friends online, 2–4 players',
		name: 'Your name',
		code: 'Room code',
		solo: 'Play solo vs bot',
		create: 'Create online game',
		or: 'or join a friend',
		join: 'Join game',
		connecting: 'Connecting…',
		rules: 'Rules',
		readRules: 'Read the rules',
		needName: 'Enter your name first',
		room: 'Room',
		copy: 'Copy invite link',
		host: '(host)',
		bot: '(bot)',
		off: '(offline)',
		addBot: 'Add bot',
		rmBot: 'Remove bot',
		timer: '1-minute turn timer',
		start: p => `Start game (${p.n}/4)`,
		keep: 'Keep this tab open: your browser runs the game.',
		waitHost: 'Waiting for the host to start…',
		chip: p =>
			`${p.name}${p.you ? ' (you)' : ''}: ${p.n} tiles${p.m ? ' ✓' : ''}, ${p.pts} pts, ${p.w} won`,
		pool: p => `Pool ${p.n}`,
		empty: 'The table is empty. Select tiles from your rack to start a set.',
		turnMine: 'Your turn',
		turnMeld: p => `Your turn: first meld ${p.pts}/30`,
		turnOf: p => `${p.name}'s turn`,
		toRack: '↩ Rack',
		undo: '⟲ Undo',
		draw: 'Draw',
		pass: 'Pass',
		end: 'End turn',
		skip: 'Skip offline player',
		sort123: 'Sort 123',
		sortCol: 'Sort colour',
		newSet: '＋ New set',
		wins: p => `${p.name} wins: Rummikub!`,
		winsPool: p => `${p.name} wins (pool ran out)`,
		next: 'Play next game',
		waitNext: 'Waiting for the host to start the next game…',
		total: 'total',
		close: 'Close',
		snd: 'Turn sound',
		vib: 'Turn vibration',
		'e.notIn': 'You are not in this game',
		'e.min2': 'Need at least 2 players',
		'e.notTurn': 'It is not your turn',
		'e.bad': 'Bad move',
		'e.mismatch': 'Tiles do not match. Undo and retry',
		'e.noTake': 'You cannot take tiles from the table into your rack',
		'e.playOne': 'Play at least one tile, or draw',
		'e.invalid': 'Every set on the table must be valid',
		'e.noTouch': 'Before your first meld you cannot change sets on the table',
		'e.meld': p => `First meld needs 30+ points (you have ${p.n})`,
		'e.full': 'Game is full or already started',
		'e.badCode': 'That room code is not valid.',
		'e.noAnswer':
			'No answer from the host. Check the room code and that the host tab is open and awake, then try again.',
		'e.noRoom':
			'Room not found. Check the code, and that the host tab is still open.',
		'e.hostOff': 'The host went offline. Waiting for them to come back…',
		'e.refused': 'The relay refused the connection.',
		'e.nobroker':
			"Can't reach the relay server. Check your internet connection or ad blocker, then try again.",
		'l.starts': p => `${p.name} starts`,
		'l.drew': p => `${p.name} drew ${p.n} tile${p.n > 1 ? 's' : ''}`,
		'l.passed': p => `${p.name} passed (pool empty)`,
		'l.played': p => `${p.name} played ${p.n} tile${p.n > 1 ? 's' : ''}`,
		'l.over': 'Game over',
	},
	es: {
		sub: 'Juega con amigos en línea, de 2 a 4 jugadores',
		name: 'Tu nombre',
		code: 'Código de sala',
		solo: 'Jugar solo contra un bot',
		create: 'Crear partida en línea',
		or: 'o únete a un amigo',
		join: 'Unirse',
		connecting: 'Conectando…',
		rules: 'Reglas',
		readRules: 'Leer las reglas',
		needName: 'Primero escribe tu nombre',
		room: 'Sala',
		copy: 'Copiar enlace de invitación',
		host: '(anfitrión)',
		bot: '(bot)',
		off: '(sin conexión)',
		addBot: 'Añadir bot',
		rmBot: 'Quitar bot',
		timer: 'Temporizador de 1 minuto por turno',
		start: p => `Empezar partida (${p.n}/4)`,
		keep: 'Mantén esta pestaña abierta: tu navegador ejecuta la partida.',
		waitHost: 'Esperando a que el anfitrión empiece…',
		chip: p =>
			`${p.name}${p.you ? ' (tú)' : ''}: ${p.n} fichas${p.m ? ' ✓' : ''}, ${p.pts} pts, ${p.w} ganadas`,
		pool: p => `Pozo ${p.n}`,
		empty:
			'La mesa está vacía. Selecciona fichas de tu atril para formar una combinación.',
		turnMine: 'Tu turno',
		turnMeld: p => `Tu turno: primera jugada ${p.pts}/30`,
		turnOf: p => `Turno de ${p.name}`,
		toRack: '↩ Atril',
		undo: '⟲ Deshacer',
		draw: 'Robar',
		pass: 'Pasar',
		end: 'Terminar turno',
		skip: 'Saltar jugador desconectado',
		sort123: 'Ordenar 123',
		sortCol: 'Ordenar por color',
		newSet: '＋ Nueva combinación',
		wins: p => `¡${p.name} gana: Rummikub!`,
		winsPool: p => `${p.name} gana (se acabó el pozo)`,
		next: 'Siguiente partida',
		waitNext: 'Esperando a que el anfitrión empiece la siguiente partida…',
		total: 'total',
		close: 'Cerrar',
		snd: 'Sonido de turno',
		vib: 'Vibración de turno',
		'e.notIn': 'No estás en esta partida',
		'e.min2': 'Se necesitan al menos 2 jugadores',
		'e.notTurn': 'No es tu turno',
		'e.bad': 'Jugada no válida',
		'e.mismatch': 'Las fichas no coinciden. Deshaz e inténtalo de nuevo',
		'e.noTake': 'No puedes llevarte fichas de la mesa a tu atril',
		'e.playOne': 'Juega al menos una ficha o roba',
		'e.invalid': 'Todas las combinaciones de la mesa deben ser válidas',
		'e.noTouch':
			'Antes de tu primera jugada no puedes modificar las combinaciones de la mesa',
		'e.meld': p => `La primera jugada necesita 30 puntos o más (tienes ${p.n})`,
		'e.full': 'La partida está llena o ya empezó',
		'e.badCode': 'Ese código de sala no es válido.',
		'e.noAnswer':
			'El anfitrión no responde. Revisa el código y que su pestaña esté abierta y activa, e inténtalo de nuevo.',
		'e.noRoom':
			'Sala no encontrada. Revisa el código y que la pestaña del anfitrión siga abierta.',
		'e.hostOff': 'El anfitrión se desconectó. Esperando a que vuelva…',
		'e.refused': 'El servidor de enlace rechazó la conexión.',
		'e.nobroker':
			'No se puede conectar con el servidor de enlace. Revisa tu conexión a internet o el bloqueador de anuncios e inténtalo de nuevo.',
		'l.starts': p => `Empieza ${p.name}`,
		'l.drew': p => `${p.name} robó ${p.n} ficha${p.n > 1 ? 's' : ''}`,
		'l.passed': p => `${p.name} pasó (pozo vacío)`,
		'l.played': p => `${p.name} jugó ${p.n} ficha${p.n > 1 ? 's' : ''}`,
		'l.over': 'Fin de la partida',
	},
}
export const fmt = (lang, k, p = {}) => {
	const v = (D[lang] && D[lang][k]) ?? D.en[k] ?? k
	return typeof v === 'function' ? v(p) : v
}
export const guessLang = () => {
	try {
		return (
			localStorage.rmkLang ||
			((navigator.language || 'en').slice(0, 2) === 'es' && 'es') ||
			'en'
		)
	} catch (e) {
		return 'en'
	}
}
export const LangCtx = createContext({ lang: 'en', setLang() {} })
export const useT = () => {
	const { lang } = useContext(LangCtx)
	return (k, p) => fmt(lang, k, p)
}
export const tr = (t, m) => (!m ? '' : typeof m === 'string' ? m : t(m.k, m.p))
