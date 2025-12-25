import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { terminalLogger } from './vite-plugin-terminal-logger'

export default defineConfig({
  plugins: [react(), terminalLogger()],
})

