import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// Emits dist/sw.js from scripts/sw-template.js after the build, with the precache list and a cache name derived from the content
// of every precached file (so any change to the app makes a new cache, and the old one is deleted on activate).
// Not cached on purpose: the lazy mqtt chunk (online play needs the network anyway), og.png (only for crawlers) and the fonts
// for scripts the app does not use (only the latin and latin-ext subsets are kept).
const swPlugin = () => ({
	name: 'rmk-service-worker',
	apply: 'build',
	writeBundle(options) {
		const out = options.dir
		const skip = f => f === 'sw.js' || f === 'og.png' || /^assets\/mqtt/.test(f) || (/\.woff2?$/.test(f) && !/-latin(-ext)?-/.test(f))
		const files = readdirSync(out, { recursive: true })
			.map(f => f.split('\\').join('/'))
			.filter(f => statSync(join(out, f)).isFile() && !skip(f))
			.sort()
		const tpl = readFileSync(new URL('./scripts/sw-template.js', import.meta.url), 'utf8')
		const hash = createHash('sha256').update(tpl) // the worker's own code is part of the version too
		for (const f of files) hash.update(f).update(readFileSync(join(out, f)))
		if ([...tpl.matchAll(/__VERSION__|__FILES__/g)].length !== 2) throw new Error('sw-template.js: placeholders changed')
		const sw = tpl.replace('__VERSION__', hash.digest('hex').slice(0, 12)).replace('__FILES__', JSON.stringify(files, null, '\t'))
		writeFileSync(join(out, 'sw.js'), sw)
		console.log(`sw.js: precaching ${files.length} files`)
	},
})

// base './' works on Vercel, GitHub Pages (any repo name) and custom domains.
// cssTarget: the default target makes Lightning CSS rewrite light-dark() into a prefers-color-scheme toggle, which ignores the
// `color-scheme` property, so the Menu > Theme override would stop working in production. These versions all support it natively.
export default defineConfig({
	plugins: [react(), swPlugin()],
	base: './',
	build: { cssTarget: ['chrome123', 'firefox120', 'safari17.5'] },
})
