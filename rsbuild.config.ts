import path from 'node:path'

import { defineConfig, type RsbuildConfig } from '@rsbuild/core'
import { pluginBabel } from '@rsbuild/plugin-babel'
import { pluginSolid } from '@rsbuild/plugin-solid'
import { pluginTypeCheck } from '@rsbuild/plugin-type-check'
import { UnoCSSRspackPlugin } from '@unocss/webpack/rspack'
import { createGenerator } from 'unocss'

import unoConfig from './uno.config'

const host = process.env.TAURI_DEV_HOST
const unoCtx = createGenerator(unoConfig)

export default defineConfig(
    async ({ env, command }) =>
        ({
            html: {
                template: './index.html',
            },
            source: {
                entry: {
                    index: './src/index.tsx',
                },
                define: {
                    // https://github.com/unocss/unocss/discussions/1908#discussioncomment-4371270
                    'import.meta.env.__UNO__': JSON.stringify(await unoCtx),
                    'import.meta.env.__UNO_THEME__': JSON.stringify((await unoCtx).config.theme),
                },
            },
            plugins: [pluginBabel({ include: /\.(?:jsx|tsx)$/, exclude: /[\\/]node_modules[\\/]/ }), pluginSolid(), pluginTypeCheck()],
            server: {
                port: 1420,
                strictPort: true,
                host: host,
            },
            dev: {
                // hmr: !!host,
                // client: { protocol: 'ws', host: 'localhost', port: 1421 },
                watchFiles: {
                    paths: ['uno.config.ts'],
                    type: 'reload-server',
                },
            },
            tools: {
                rspack: {
                    watchOptions: {
                        ignored: ['**/src-tauri/**'],
                    },
                    plugins: [UnoCSSRspackPlugin({})],
                },
            },
            resolve: {
                alias: {
                    '~': path.resolve(__dirname, './src'),
                },
            },
        }) as RsbuildConfig,
)
