import { type Component, createMemo, Index, Show } from 'solid-js'
import type { FsNode } from '../bindings'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '~/components/ui/accordion'

import type { FileTree } from './ArchiveContents'

type ExcludeFsNode = Exclude<FsNode, { type: 'None' }>

export const ArchiveContent: Component<{
    contents: FileTree
}> = props => {
    const contents = () => props.contents

    const value = () => contents().value
    const name = () => (value().type === 'None' ? '*' : (value() as ExcludeFsNode).name)

    const emojiNameElement = () => {
        let emoji: string
        switch (value().type) {
            case 'None':
            case 'Dir':
                emoji = '📁'
                break
            case 'File':
                emoji = '📄'
        }

        return (
            <span
                class={`break-all before:(position-absolute left-0 content-['${emoji}'])`}
                classList={{ 'color-violet-400': contents().unziped }}
            >
                {name()}
            </span>
        )
    }

    return (
        <Show when={contents().children.length > 0} fallback={<div class="mr-4 pl-5 border-l position-relative">{emojiNameElement()}</div>}>
            <AccordionItem value={`item-${name()}`} class="pl-0 border-b-none border-l">
                <AccordionTrigger class="py-2 hover:decoration-none text-align-start">
                    <div class="pl-5 position-relative">{emojiNameElement()}</div>
                </AccordionTrigger>
                <AccordionContent class="ml-4 [&>div:first-child]:pb-0">
                    <Accordion multiple>
                        <Index each={contents().children}>{item => <ArchiveContent contents={item()} />}</Index>
                    </Accordion>
                </AccordionContent>
            </AccordionItem>
        </Show>
    )
}

export default ArchiveContent
