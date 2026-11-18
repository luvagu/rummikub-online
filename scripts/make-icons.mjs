// Dev-only: renders the install and share images from the logo artwork (the favicon tile and the RUMMIKUB wordmark).
// The PNGs are committed, so this only needs to run when the artwork changes:  npm run icons
//
//   public/apple-touch-icon.png      180x180  opaque (iOS paints transparent pixels black)
//   public/icons/icon-192.png        192x192  rounded tile, transparent corners ("any")
//   public/icons/icon-512.png        512x512  same
//   public/icons/icon-maskable-512.png  512x512 full bleed, artwork inside the 80% safe zone ("maskable")
//   public/og.png                    1200x630 share card
//
// Text is rendered from system fonts (resvg cannot read the woff2 files the app ships), so run it on a machine that has
// Arial / Arial Black (macOS, Windows). The result does not depend on fonts at runtime: it is just PNGs.
import { Resvg } from '@resvg/resvg-js'
import { mkdirSync, writeFileSync } from 'node:fs'

const FELT = '#1b5e20'
const COLORS = ['#1b1b1b', '#d32f2f', '#1565c0', '#d97800'] // keep in sync with COLORS in src/game.js
const pub = new URL('../public/', import.meta.url)
mkdirSync(new URL('icons/', pub), { recursive: true })

const render = (svg, width, name) => {
	const png = new Resvg(svg, { fitTo: { mode: 'width', value: width }, font: { loadSystemFonts: true, defaultFontFamily: 'Arial' } }).render().asPng()
	writeFileSync(new URL(name, pub), png)
	console.log(`${name.padEnd(30)} ${width}px  ${(png.length / 1024).toFixed(1)} kB`)
}

// The favicon tile on a 64-unit canvas. `s` scales the tile around the centre.
const tile = s => `
  <g transform="translate(32 32) rotate(-8) scale(${s}) translate(-32 -32)">
    <rect x="12" y="7" width="40" height="50" rx="6" fill="#fffdf5"/>
    <path d="M17 7h30a5 5 0 0 1 5 5v4H12v-4a5 5 0 0 1 5-5Z" fill="#e9e5d7"/>
    <text x="32" y="45" text-anchor="middle" font-family="Arial" font-weight="700" font-size="34" fill="#d62828">7</text>
  </g>`
const icon = ({ radius, s }) =>
	`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="${radius}" fill="${FELT}"/>${tile(s)}</svg>`

render(icon({ radius: 0, s: 0.95 }), 180, 'apple-touch-icon.png')
render(icon({ radius: 14, s: 1 }), 192, 'icons/icon-192.png')
render(icon({ radius: 14, s: 1 }), 512, 'icons/icon-512.png')
// Maskable: the platform crops to a circle/squircle, keeping the inner 80%. The tile's half diagonal (32 units at scale 1) must
// stay inside radius 0.4 * 64 = 25.6 units, hence scale <= 0.8.
render(icon({ radius: 0, s: 0.78 }), 512, 'icons/icon-maskable-512.png')

// ---- share card ----
const W = 1200,
	H = 630,
	TW = 112,
	TH = 150,
	GAP = 16
const word = 'RUMMIKUB'
const x0 = (W - (word.length * TW + (word.length - 1) * GAP)) / 2
const tiles = [...word]
	.map((c, i) => {
		const x = x0 + i * (TW + GAP)
		return `<g>
    <rect x="${x}" y="${204 + 8}" width="${TW}" height="${TH}" rx="14" fill="#b9a77a"/>
    <rect x="${x}" y="204" width="${TW}" height="${TH}" rx="14" fill="url(#paper)" stroke="#d6c690" stroke-width="2"/>
    <text x="${x + TW / 2}" y="${204 + TH / 2 + 28}" text-anchor="middle" font-family="Arial Black, Arial" font-weight="900" font-size="84" fill="${COLORS[i % 4]}">${c}</text>
  </g>`
	})
	.join('')
const og = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">
  <defs>
    <radialGradient id="felt" cx="50%" cy="38%" r="75%"><stop offset="0" stop-color="#2e7d32"/><stop offset="1" stop-color="#12361a"/></radialGradient>
    <linearGradient id="paper" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fffdf6"/><stop offset="1" stop-color="#f1e7c4"/></linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#felt)"/>
  ${tiles}
  <text x="${W / 2}" y="470" text-anchor="middle" font-family="Arial" font-weight="700" font-size="44" fill="#ffffff">Play Rummikub online with friends</text>
  <text x="${W / 2}" y="528" text-anchor="middle" font-family="Arial" font-size="30" fill="#ffffffcc">Share a room code, or play solo vs bots  ·  English / Español</text>
</svg>`
render(og, W, 'og.png')
