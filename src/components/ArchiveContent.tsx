import { type Component, createMemo, Index, Match, Show, Switch } from 'solid-js'
import type { FsNode } from '../bindings'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '~/components/ui/accordion'

import type { FileContents } from './ArchiveContents'

type ExcludeFsNode = Exclude<FsNode, { type: 'None' }>

export const ArchiveContent: Component<{
    contents: FileContents
}> = props => {
    const contents = () => props.contents

    const value = () => contents().value
    const name = () => {
        if (value().type === 'None') {
            return '*'
        }
        return (value() as ExcludeFsNode).name
    }

    const emojiName = createMemo(() => {
        switch (value().type) {
            case 'None':
                return `📁 ${name()}`
            case 'Dir':
                return `📁 ${name()}`
            case 'File':
                return `📄 ${name()}`
        }
    })

    const emojiNameElement = () => {
        return <span class={contents().unziped ? 'color-violet-400' : ''}>{emojiName()}</span>
    }

    return (
        <Show when={contents().children.length > 0} fallback={<div class="pl-5 border-l">{emojiNameElement()}</div>}>
            <AccordionItem value={`item-${name()}`} class="pl-5 border-b-none border-l">
                <AccordionTrigger class="py-2 hover:decoration-none">
                    <div>{emojiNameElement()}</div>
                </AccordionTrigger>
                <AccordionContent>
                    <Accordion multiple>
                        <Index each={contents().children}>{item => <ArchiveContent contents={item()} />}</Index>
                    </Accordion>
                </AccordionContent>
            </AccordionItem>
        </Show>
    )
}

export default ArchiveContent
