import { transformThemeString } from '@unocss/rule-utils'
import { defineConfig, presetIcons, PresetUnoTheme, presetWind, transformerDirectives, transformerVariantGroup } from 'unocss'
import presetAnimations from 'unocss-preset-animations'
import presetChinese, { chineseTypography } from 'unocss-preset-chinese'
import { presetScrollbar } from 'unocss-preset-scrollbar'
import { presetShadcn } from 'unocss-preset-shadcn'

export default defineConfig<PresetUnoTheme>({
    theme: {
        spacing: {
            4: '1rem',
        },
        colors: {
            sidebar: {
                DEFAULT: 'hsl(var(--sidebar-background))',
                foreground: 'hsl(var(--sidebar-foreground))',
                primary: 'hsl(var(--sidebar-primary))',
                'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
                accent: 'hsl(var(--sidebar-accent))',
                'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
                border: 'hsl(var(--sidebar-border))',
                ring: 'hsl(var(--sidebar-ring))',
            },
        },
    },
    extendTheme: theme => {
        return {
            ...theme,
            breakpoints: {
                ...theme.breakpoints,
                sm: '480px',
                md: '600px',
                lg: '960px',
            },
        }
    },
    presets: [
        presetWind(),
        presetIcons({
            scale: 1.3,
        }),
        presetAnimations(),
        presetShadcn({
            color: 'violet',
            // With default setting for SolidUI, you need to set the darkSelector option.
            darkSelector: '[data-kb-theme="dark"]',
        }),
        chineseTypography(),
        presetChinese({
            chineseType: 'simplified',
        }),
        presetScrollbar(),
    ],
    rules: [
        [
            /^text-(.*)$/,
            ([, c], { theme }) => {
                if (typeof c === 'string') {
                    c = c.replace('-', '.')
                    c = 'textColors.' + c
                    let color = transformThemeString(c, theme, false)
                    if (!color) {
                        c = c.replace('textColors.', 'colors.')
                        color = transformThemeString(c, theme, false)
                    }
                    if (color) {
                        return { color: color }
                    }
                }
            },
        ],
    ],
    preflights: [
        {
            getCSS: ({ theme }) => `
            html,
            :host {
                font-family: ${theme.fontFamily?.hei};
            }
            `,
        },
    ],
    transformers: [transformerVariantGroup(), transformerDirectives()],
})
