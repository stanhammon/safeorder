import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// Generates the home-screen icons in public/ from public/favicon.svg:
//   npx pwa-assets-generator
export default defineConfig({
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, padding: 0, resizeOptions: { background: '#2f7d6d' } },
    apple: { ...minimal2023Preset.apple, padding: 0, resizeOptions: { background: '#2f7d6d' } },
  },
  images: ['public/favicon.svg'],
})
