import { defineConfig, presetIcons, type PresetUnoTheme, presetWind, transformerDirectives, transformerVariantGroup } from 'unocss'
import presetAnimations from 'unocss-preset-animations'
import presetChinese, { chineseTypography } from 'unocss-preset-chinese'
import { presetColor } from 'unocss-preset-color/src/index.ts'
import { presetScrollbar } from 'unocss-preset-scrollbar'
import { presetShadcn } from 'unocss-preset-shadcn'

export default defineConfig<PresetUnoTheme>({
    theme: {
        spacing: {
            4: '1rem',
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
        presetWind({ dark: { dark: '[data-kb-theme="dark"]' } }),
        presetIcons({
            scale: 1.3,
        }),
        presetAnimations(),
        presetShadcn({
            color: {
                base: 'green',
                name: 'whitegreen',
                light: {
                    background: '60 4% 95%',
                    foreground: '86 54% 17%',
                    card: '60 4% 95%',
                    'card-foreground': '86 54% 17%',
                    popover: '60 4% 95%',
                    'popover-foreground': '86 54% 17%',
                    primary: '88 59% 69%',
                    'primary-foreground': '86 54% 17%',
                    secondary: '105 6% 63%',
                    'secondary-foreground': '83 100% 21%',
                    muted: '103 11% 88%',
                    'muted-foreground': '83 100% 21%',
                    accent: '83 64% 50%',
                    'accent-foreground': '83 100% 21%',
                    destructive: '4 100% 64%',
                    'destructive-foreground': '83 100% 21%',
                    border: '88 59% 69%',
                    input: '86 43% 52%',
                    ring: '80 98% 33%',
                },
                dark: {
                    background: '87 54% 17%',
                    foreground: '111 71% 86%',
                    card: '87 54% 17%',
                    'card-foreground': '111 71% 86%',
                    popover: '87 54% 17%',
                    'popover-foreground': '111 71% 86%',
                    primary: '112 27% 22%',
                    'primary-foreground': '111 71% 86%',
                    secondary: '108 9% 34%',
                    'secondary-foreground': '109 9% 34%',
                    muted: '113 18% 18%',
                    'muted-foreground': '109 9% 34%',
                    accent: '111 28% 63%',
                    'accent-foreground': '109 9% 34%',
                    destructive: '4 100% 64%',
                    'destructive-foreground': '109 9% 34%',
                    border: '113 24% 29%',
                    input: '112 26% 33%',
                    ring: '112 25% 39%',
                },
            },
            // With default setting for SolidUI, you need to set the darkSelector option.
            darkSelector: '[data-kb-theme="dark"]',
        }),
        chineseTypography(),
        presetChinese({
            chineseType: 'simplified',
        }),
        presetScrollbar(),
        presetColor({
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
            contrast: true,
            fallback: true,
        }),
    ],
    rules: [],
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
    transformers: [transformerVariantGroup(), transformerDirectives({ enforce: 'pre' })],
})
