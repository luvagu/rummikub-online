import { useContext } from 'react'
import { LangCtx, useT } from './i18n.js'
import { Modal } from './ui.jsx'
const R = {
	en: {
		h: 'Rummikub rules',
		items: [
			[
				'Goal.',
				'Be the first to play every tile from your rack by forming sets.',
			],
			[
				'Sets.',
				'A group is 3 or 4 tiles of the same number in different colours. A run is 3 or more consecutive numbers in one colour. 1 is always low and never follows 13.',
			],
			[
				'Setup.',
				'106 tiles (two of each number 1–13 in four colours, plus 2 jokers). Everyone takes 14 tiles; the rest form the pool. Play passes clockwise.',
			],
			[
				'First meld.',
				'Your first play must total at least 30 points using only tiles from your own rack. A joker counts as the tile it stands for. You cannot use tiles already on the table until you have melded.',
			],
			[
				'Your turn.',
				"Play tiles from your rack and/or rearrange the table: add to sets, split runs, take a fourth tile from a group, combine sets. When you finish, every set must be valid and no loose tiles may remain. You must play at least one rack tile, or draw one tile (your turn ends, and you can't play that tile until your next turn). If the pool is empty, drawing counts as a pass.",
			],
			[
				'Jokers.',
				'A joker can be any tile. After your first meld you may take a joker from a set, for example by replacing it with the tile it stood for, but the joker must end the turn in a valid set (a new one or an existing one). Jokers never return to your rack. A joker left on your rack costs 30 points.',
			],
			[
				'Winning a game.',
				'Empty your rack and call "Rummikub!". Everyone else scores minus the face value of their remaining tiles, and the winner scores the total. If the pool runs out and nobody can play, the lowest rack wins and the others lose the difference (on a tie, the player who sits first at the table wins).',
			],
			[
				'Several games.',
				'Scores and wins add up across games in the same room. The player who starts rotates every game.',
			],
			[
				'Timer.',
				'Optional: the host picks Off, 15, 30, 45, 60 or 90 seconds per turn (45 by default). A draining bar shows the time left, and a soft chime and a countdown warn you in the last few seconds. If time runs out you draw one tile, or three if your move was unfinished.',
			],
		],
		c: 'Controls in this game',
		ctl: [
			'Tap tiles to select them (several at once). They can be in your rack or on the table.',
			'Tap New set to start a set with them, or the + at the end of a set to add them to it. On a computer with a mouse you can also drag tiles onto a set, an empty part of the table, or your rack.',
			'To rack returns selected tiles you brought from your rack. Undo resets your turn.',
			'Draw takes a tile and ends your turn. The sort buttons order your rack by number or colour, and the smiley button sends a reaction.',
			'The host can use Skip offline player when it is the turn of someone who lost connection, and End round to cancel the round with no points.',
			'Sets with a red outline are not valid yet. End turn unlocks when everything is valid.',
			'The small shape on each tile (circle, triangle, square, diamond) shows its colour, for colour-blind players.',
		],
	},
	es: {
		h: 'Reglas de Rummikub',
		items: [
			[
				'Objetivo.',
				'Sé el primero en colocar todas las fichas de tu estante formando combinaciones.',
			],
			[
				'Combinaciones.',
				'Un grupo son 3 o 4 fichas del mismo número en colores distintos. Una escalera son 3 o más números consecutivos del mismo color. El 1 siempre es el más bajo y nunca va después del 13.',
			],
			[
				'Preparación.',
				'106 fichas (dos de cada número del 1 al 13 en cuatro colores, más 2 comodines). Cada jugador toma 14 fichas; el resto forma el pozo. El turno pasa en sentido horario.',
			],
			[
				'Primera jugada.',
				'Debe sumar al menos 30 puntos usando solo fichas de tu propio estante. Un comodín vale lo que la ficha que sustituye. No puedes usar fichas que ya estén en la mesa hasta que hayas hecho tu primera jugada.',
			],
			[
				'Tu turno.',
				'Juega fichas de tu estante y/o reorganiza la mesa: agrega a combinaciones, divide escaleras, toma la cuarta ficha de un grupo, une combinaciones. Al terminar, todas las combinaciones deben ser válidas y no puede quedar ninguna ficha suelta. Debes jugar al menos una ficha de tu estante o tomar una del pozo (tu turno termina y no puedes jugar esa ficha hasta tu próximo turno). Si el pozo está vacío, tomar cuenta como pasar.',
			],
			[
				'Comodines.',
				'Un comodín puede ser cualquier ficha. Tras tu primera jugada puedes tomar un comodín de una combinación, por ejemplo sustituyéndolo por la ficha que representaba, pero el comodín debe terminar el turno en una combinación válida (nueva o ya existente). Los comodines nunca vuelven a tu estante. Un comodín que se queda en tu estante cuesta 30 puntos.',
			],
			[
				'Ganar una partida.',
				'Vacía tu estante y grita «¡Rummikub!». Los demás restan el valor de sus fichas restantes y el ganador suma el total. Si se acaba el pozo y nadie puede jugar, gana quien tenga el estante de menor valor y los demás pierden la diferencia (en caso de empate gana quien se siente primero en la mesa).',
			],
			[
				'Varias partidas.',
				'Los puntos y las victorias se acumulan entre partidas de la misma sala. El jugador que empieza rota en cada partida.',
			],
			[
				'Temporizador.',
				'Opcional: el anfitrión elige No, 15, 30, 45, 60 o 90 segundos por turno (45 por defecto). Una barra que se vacía muestra el tiempo restante, y un sonido suave y una cuenta atrás te avisan en los últimos segundos. Si se acaba el tiempo tomas una ficha, o tres si tu jugada estaba sin terminar.',
			],
		],
		c: 'Controles en este juego',
		ctl: [
			'Toca fichas para seleccionarlas (varias a la vez). Pueden estar en tu estante o en la mesa.',
			'Toca Agregar juego para formar uno con ellas, o el + al final de una combinación para agregarlas. En una computadora con mouse también puedes arrastrar fichas a una combinación, a un espacio vacío de la mesa o a tu estante.',
			'Al estante devuelve las fichas seleccionadas que sacaste de tu estante. Deshacer reinicia tu turno.',
			'Tomar saca una ficha del pozo y termina tu turno. Los botones de orden ordenan tu estante por número o color, y el botón de la carita envía una reacción.',
			'El anfitrión puede usar Saltar jugador desconectado cuando es el turno de alguien sin conexión, y Terminar ronda para cancelar la ronda sin puntos.',
			'Las combinaciones con borde rojo aún no son válidas. Terminar turno se activa cuando todo es válido.',
			'La pequeña forma en cada ficha (círculo, triángulo, cuadrado, rombo) indica su color, para jugadores daltónicos.',
		],
	},
}
export default function Rules({ close }) {
	const { lang } = useContext(LangCtx),
		t = useT(),
		r = R[lang] || R.en
	return (
		<Modal title={r.h} onClose={close}>
			<h2>{r.h}</h2>
			{r.items.map(([h, b]) => (
				<p key={h}>
					<b>{h}</b> {b}
				</p>
			))}
			<h3>{r.c}</h3>
			<ul>
				{r.ctl.map(x => (
					<li key={x}>{x}</li>
				))}
			</ul>
			<button onClick={close}>{t('close')}</button>
		</Modal>
	)
}
