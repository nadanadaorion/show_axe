import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    rollupOptions: {
      output: {
        // @supabase/supabase-js and dexie are large, cohesive vendor libraries that change far
        // less often than app code. Splitting them out keeps them cacheable across deploys (a
        // user who already has these chunks skips re-downloading them on the next update) and
        // drops the main chunk from ~561 kB to ~247 kB, clearing Vite's 500 kB warning without
        // an arbitrary/unmeasured split — see docs/24-CURRENT_IMPLEMENTATION_AUDIT.md.
        manualChunks: {
          supabase: ['@supabase/supabase-js'],
          dexie: ['dexie'],
        },
      },
    },
  },
})
