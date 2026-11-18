import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// base './' works on Vercel, GitHub Pages (any repo name) and custom domains.
// cssTarget: the default target makes Lightning CSS rewrite light-dark() into a prefers-color-scheme toggle, which ignores the
// `color-scheme` property, so the Menu > Theme override would stop working in production. These versions all support it natively.
export default defineConfig({
	plugins: [react()],
	base: './',
	build: { cssTarget: ['chrome123', 'firefox120', 'safari17.5'] },
})
