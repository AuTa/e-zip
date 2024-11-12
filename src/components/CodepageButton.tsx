import { Description as ComboboxDescription, ErrorMessage as ComboboxErrorMessage, Label as ComboboxLabel } from '@kobalte/core/combobox'
import { Show, type Component, type JSX } from 'solid-js'
import { Link } from '@kobalte/core/link'

import { Badge } from '~/components/ui/badge'
import {
    Combobox,
    ComboboxContent,
    ComboboxControl,
    ComboboxInput,
    ComboboxItem,
    ComboboxItemIndicator,
    ComboboxItemLabel,
    ComboboxTrigger,
} from '~/components/ui/combobox'
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover'
import type { Codepage } from '../bindings'
import { RefreshArchiveButton } from './RefreshArchiveButton'

import '~/App.css'

const CODEPAGE_OPTIONS = ['GB2312', 'BIG5', 'SHIFT_JIS', 'UTF_8']

export const CodepageButton: Component<{
    codepage: Codepage | null
    setCodepage: (codepage: Codepage | null) => void
    onRefresh: () => void
}> = props => {
    const onClick: JSX.EventHandler<Element, Event> = event => {
        event.stopPropagation()
    }

    const codepage = () => {
        const codepage = props.codepage
        if (codepage === null) {
            return null
        }
        if (typeof codepage === 'object') {
            return codepage.other
        }
        return codepage as string
    }
    const setCodepage = (input: string) => {
        let cp = props.codepage
        switch (input) {
            case 'SHIFT_JIS':
            case 'GB2312':
            case 'BIG5':
            case 'UTF_8':
                cp = input
                break
            case '':
                cp = null
                break
            default:
                if (!Number.isNaN(Number(input))) {
                    cp = { other: Number(input) }
                }
        }
        props.setCodepage(cp)
    }

    const validationState = () => {
        const cp = codepage()
        return !cp || typeof cp === 'string' || (cp >= 0 && cp <= 65001) ? 'valid' : 'invalid'
    }

    return (
        <Popover>
            <PopoverTrigger onClick={onClick}>
                <Badge class="">
                    <Show when={codepage() !== null} fallback="Codepage">
                        {codepage()}
                    </Show>
                </Badge>
            </PopoverTrigger>
            <PopoverContent onClick={onClick}>
                <Combobox
                    options={CODEPAGE_OPTIONS}
                    defaultValue={codepage()}
                    onInputChange={setCodepage}
                    validationState={validationState()}
                    defaultFilter="startsWith"
                    itemComponent={props => (
                        <ComboboxItem item={props.item}>
                            <ComboboxItemLabel>{props.item.rawValue}</ComboboxItemLabel>
                            <ComboboxItemIndicator />
                        </ComboboxItem>
                    )}
                >
                    <ComboboxLabel>请选择或输入你需要的代码页数字</ComboboxLabel>
                    <ComboboxControl aria-label="Codepage">
                        <ComboboxInput value={codepage() !== null ? (codepage() as string) : ''} />
                        <ComboboxTrigger />
                    </ComboboxControl>
                    <ComboboxDescription>
                        <Link class="link" target="_blank" href="https://learn.microsoft.com/windows/win32/intl/code-page-identifiers">
                            其他代码页
                        </Link>
                    </ComboboxDescription>
                    <ComboboxErrorMessage>The codepage must be a number between 0 and 65001!</ComboboxErrorMessage>
                    <ComboboxContent />
                </Combobox>
                <RefreshArchiveButton onRefresh={props.onRefresh} />
            </PopoverContent>
        </Popover>
    )
}
