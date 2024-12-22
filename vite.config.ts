import path from 'node:path'

import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'
import unoCss from 'unocss/vite'
import { createGenerator, type PresetUnoTheme, type UnoGenerator } from 'unocss'

import config from './uno.config'

const host = process.env.TAURI_DEV_HOST
const unoCtx = createGenerator(config)

// https://vitejs.dev/config/
export default defineConfig(async () => ({
    plugins: [unoCss(), solid()],

    // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
    //
    // 1. prevent vite from obscuring rust errors
    clearScreen: false,
    // 2. tauri expects a fixed port, fail if that port is not available
    server: {
        port: 1420,
        strictPort: true,
        host: host || false,
        hmr: host
            ? {
                  protocol: 'ws',
                  host,
                  port: 1421,
              }
            : undefined,
        watch: {
            // 3. tell vite to ignore watching `src-tauri`
            ignored: ['**/src-tauri/**'],
        },
    },
    resolve: {
        alias: {
            '~': path.resolve(__dirname, './src'),
        },
    },
    define: {
        // https://github.com/unocss/unocss/discussions/1908#discussioncomment-4371270
        'import.meta.evn.__UNO__': await unoCtx,
        'import.meta.env.__UNO_THEME__':(await unoCtx).config.theme,
    },
}))
