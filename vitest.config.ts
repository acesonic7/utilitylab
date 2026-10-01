import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// The same "@/…" alias as tsconfig.json, so tests can import app code such as API routes.
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
})
