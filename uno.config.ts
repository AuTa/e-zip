import { defineConfig, presetIcons, presetUno, transformerDirectives, transformerVariantGroup, PresetUnoTheme } from 'unocss'
import presetAnimations from 'unocss-preset-animations'
import presetChinese, { chineseTypography } from 'unocss-preset-chinese'
import { presetShadcn } from 'unocss-preset-shadcn'

export default defineConfig<PresetUnoTheme>({
    presets: [
        presetUno(),
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
    ],
    preflights: [
        {
            getCSS: ({ theme }) => `
            html,
            :host {
                font-family: ${theme.fontFamily?.chinese};
            }
            `,
        },
    ],
    transformers: [transformerVariantGroup(), transformerDirectives()],
})
