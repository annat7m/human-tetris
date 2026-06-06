import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { cloudflare } from '@cloudflare/vite-plugin'

const config = defineConfig(({ mode }) => {
  const isTest = mode === 'test' || process.env.VITEST === 'true'

  return {
    resolve: { tsconfigPaths: true },
    plugins: [
      devtools(),
      ...(isTest ? [] : [cloudflare({ viteEnvironment: { name: 'ssr' } })]),
      tailwindcss(),
      tanstackStart(),
      viteReact(),
    ],
  }
})

export default config
