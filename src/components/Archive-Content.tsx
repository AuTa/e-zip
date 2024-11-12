import { For } from 'solid-js'
import type { FsNode } from '../bindings'

type ExcludeFsNode = Exclude<FsNode, { type: 'None' }>

type FileContents = {
    value: FsNode
    children: FileContents[]
}

export function ArchiveContent(props: { contents: FileContents }) {
    const contents = () => props.contents
    const value = () => contents().value
    if (value().type === 'None') {
        return (
            <div>
                <For each={contents().children}>{(item) => <ArchiveContent contents={item} />}</For>
            </div>
        )
    }
    if ('name' in value()) {
        return (
            <ol>
                {(value() as ExcludeFsNode).name}
                <For each={contents().children}>{(item) => <ArchiveContent contents={item} />}</For>
            </ol>
        )
    }
}
