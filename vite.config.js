import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// base './' works on Vercel, GitHub Pages (any repo name) and custom domains
export default defineConfig({ plugins: [react()], base: './' })
