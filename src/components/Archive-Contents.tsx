import { listen, TauriEvent } from '@tauri-apps/api/event'
import { For, Index } from 'solid-js'
import type { FsNode } from '../bindings'
import { ArchiveContent } from './Archive-Content'
import { createStore } from 'solid-js/store'

type Result<T, E> = { Ok?: T; Error?: E }

type FileContents = {
    value: FsNode
    children: FileContents[]
}

type DragDropFileContentsResult = Result<DragDropFileContents, string>

type DragDropFileContents = {
    path: string
    tree: FileContents
}

type FileStore = {
    path: string
    contents: FileContents
}

export function ArchiveContents() {
    const [name, setName] = createStore({ files: [] as FileStore[] })

    listen(TauriEvent.DRAG_DROP, (event) => {
        const payload = event.payload as { paths: string[]; position: { x: number; y: number } }
        const { paths } = payload
        const path_signal = paths.map((p): FileStore => {
            return {
                path: p,
                contents: { value: { type: 'None' }, children: [] },
            }
        })
        setName('files', (files) => [...files, ...path_signal])
    })

    listen('drag_drop_file_contents', (event) => {
        console.log(event.payload)

        const result = event.payload as DragDropFileContentsResult
        const contents = result.Ok
        if (contents !== undefined) {
            setName(
                'files',
                (f) => f.path === contents.path,
                'contents',
                (_) => contents.tree
            )
        }
    })
    return (
        <div>
            <h1>ArchiveContents</h1>
            <Index each={name.files}>
                {(item) => (
                    <li>
                        {item().path}
                        <For each={item().contents.children}>
                            {(item) => (
                                <li>
                                    <ArchiveContent contents={item} />
                                </li>
                            )}
                        </For>
                    </li>
                )}
            </Index>
        </div>
    )
}
