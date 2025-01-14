import { TauriEvent, listen, type Event } from '@tauri-apps/api/event'
import { For, Index, Match, Show, Switch, createSignal, type Component, type ComponentProps } from 'solid-js'
import { createStore, produce, reconcile } from 'solid-js/store'

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '~/components/ui/accordion'
import { Badge } from '~/components/ui/badge'
import { Flex } from '~/components/ui/flex'
import { Grid } from '~/components/ui/grid'
import { Label } from '~/components/ui/label'
import { Separator } from '~/components/ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from '~/components/ui/tooltip'
import { cn } from '~/lib/utils'
import {
    commands,
    events,
    type Archive,
    type ArchiveContents as SuperArchiveContents,
    type Codepage,
    type FsNode,
    type ShowArchiveContentsEvent,
    type UnzipedArchiveEvent,
} from '../bindings'
import { ArchiveContent } from './ArchiveContent'
import { CodepageButton } from './CodepageButton'
import { usePasswordInput } from './Password'
import { RefreshArchiveButton } from './RefreshArchiveButton'
import { RemoveArchiveButton } from './RemoveArchiveButton'
import { UnzipControl } from './UnzipControl'
import { LoadingArchiveButton } from './LoadingArchiveButton'

export type FileTree = {
    value: FsNode
    children: FileTree[]
    unziped: boolean
}

const defaultFileTree: FileTree = { value: { type: 'None' }, children: [], unziped: false }

type ArchiveContents = Omit<SuperArchiveContents, 'contents'> & {
    contents: FileTree
}

type ArchiveExtend = {
    count: FileCounter
    unzippingFile: string
    unzipStatus: null | 'Running' | 'Completed'
}

export type FileStore = ArchiveContents & ArchiveExtend & { id: number }

function newArchiveContents(path: string): ArchiveContents {
    return {
        path,
        contents: defaultFileTree,
        password: null,
        codepage: null,
        multiVolume: null,
        hasRootDir: false,
    }
}

const defaultArchiveExtend: ArchiveExtend = {
    count: createFileCount(),
    unzippingFile: '',
    unzipStatus: null,
}

function newFileStore(path: string, id: number): FileStore {
    return {
        ...newArchiveContents(path),
        ...defaultArchiveExtend,
        id: id,
    }
}

// [fileCount, unzipedCount]
interface FileCounter {
    dir: [number, number]
    file: [number, number]
}

function createFileCount(): FileCounter {
    return {
        dir: [0, 0],
        file: [0, 0],
    }
}

export const ArchiveContentsComponent: Component<ComponentProps<'div'>> = props => {
    const [files, setFiles] = createStore({ files: [] as FileStore[] })
    const [unzipedPaths, setUnzipedPaths] = createStore([] as (string | string[])[])
    const [recentlyUnzipedPath, setRecentlyUnzipedPath] = createSignal<string | string[]>('')
    const [password] = usePasswordInput()

    const [expandedItem, setExpandedItem] = createSignal<string[]>([])

    listen(TauriEvent.DRAG_DROP, async event => {
        const payload = event.payload as { paths: string[]; position: { x: number; y: number } }
        const { paths } = payload
        let id = files.files.length === 0 ? 0 : files.files[files.files.length - 1].id + 1
        const path2Files = paths
            .filter(p => !files.files.some(f => f.path === p))
            .map(p => {
                return newFileStore(p, id++)
            })
        setFiles('files', [...files.files, ...path2Files])
        const unlisten = await events.showArchiveContentsEvent.listen(event => onDragDrop(event))
        await commands.showArchivesContents(paths, password()).finally(() => unlisten())
    })

    const onDragDrop = (event: Event<ShowArchiveContentsEvent>) => {
        const result = event.payload
        console.log(result)
        if (result.status === 'error') {
            const error = result.error
            if (typeof error === 'string') {
            } else if ('UnsupportedFile' in error) {
                console.error('UnsupportedFile', error.UnsupportedFile)
                setFiles(
                    'files',
                    files.files.filter(f => f.path !== error.UnsupportedFile),
                )
            }
            return
        }
        const ac = result.data as ArchiveContents
        let path = ac.path
        if (ac.multiVolume) {
            const actualPath = ac.multiVolume.actualPath
            if (path !== actualPath && files.files.some(f => f.path === path)) {
                setFiles(
                    'files',
                    files.files.filter(f => f.path !== actualPath),
                )
            } else {
                path = actualPath
            }
        }
        setFiles(
            'files',
            f => f.path === path,
            produce(file => {
                file.password = ac.password
                file.contents = ac.contents
                file.codepage = ac.codepage
                file.hasRootDir = ac.hasRootDir
                file.count = handleFileCount(ac.contents, ac.hasRootDir)
                if (ac.multiVolume) {
                    file.path = ac.multiVolume.volumes[0] ?? path
                    file.multiVolume = ac.multiVolume
                }
                setExpandedItem(prev => [...prev, `item-${file.id}`])
            }),
        )
    }

    const handleFileCount = (contents: FileTree, hasRootDir:boolean): FileCounter => {
        const count = createFileCount()
        // 如果没有根文件夹, 解压的时候会添加.
        if (!hasRootDir) {
            count.dir[0] += 1
        }
        const handleSetCount = (contents: FileTree) => {
            switch (contents.value.type) {
                case 'Dir':
                    count.dir[0] += 1
                    break
                case 'File':
                    count.file[0] += 1
            }
            contents.children.forEach(handleSetCount)
        }

        handleSetCount(contents)

        return count
    }

    const handleUnzipedFile = (event: UnzipedArchiveEvent) => {
        const [archivePath, unzipedArchiveStatus] = event
        if (typeof unzipedArchiveStatus === 'string') {
            if (unzipedArchiveStatus === 'Running') {
                setFiles('files', file => file.path === archivePath, 'unzipStatus', 'Running')
                return
            }
            if (unzipedArchiveStatus === 'Completed') {
                const index = files.files.findIndex(f => f.path === archivePath)
                if (index === -1) {
                    return
                }
                setFiles('files', file => file.path === archivePath, 'unzipStatus', 'Completed')
                const fileStore = files.files[index]
                if (isUnzipComplated(fileStore.id)) {
                    const paths = fileStore.multiVolume ? fileStore.multiVolume.volumes : fileStore.path
                    setUnzipedPaths(unzipedPaths.length, paths)
                    setRecentlyUnzipedPath(paths)
                }
                return
            }
        }

        const parts = unzipedArchiveStatus.Ok.split(/[\\\/]/)
        outerLoop: for (const fileStore of files.files) {
            if (fileStore.path !== archivePath) {
                continue
            }
            let [contents] = createStore(fileStore.contents)
            const [, setCount] = createStore(fileStore.count)
            const [, setFileStore] = createStore(fileStore)
            for (const [i, part] of parts.entries()) {
                // 如果没有根文件夹, 解压的时候会添加, 所以要从第一个开始.
                const addRootDir = i === 0 && !fileStore.hasRootDir
                const [children, setChildren] = addRootDir ? createStore([contents]) : createStore(contents.children)
                for (const [j, child] of children.entries()) {
                    const value = child.value
                    // NOTE: Unicode 的归一化方法（如 NFC 和 NFD）：
                    // - NFC（Normalization Form C）：将字符组合为单一的字符.
                    // - NFD（Normalization Form D）：将字符分解为基本字符和附加符号.
                    if (('name' in value && value.name.normalize('NFC') === part.normalize('NFC')) || value.type === 'None') {
                        if (i === parts.length - 1) {
                            if (!child.unziped) {
                                setChildren(j, 'unziped', true)
                                setFileStore('unzippingFile', part)
                                switch (value.type) {
                                    case 'None':
                                    case 'Dir':
                                        setCount('dir', 1, prev => prev + 1)
                                        break
                                    case 'File':
                                        setCount('file', 1, prev => prev + 1)
                                }
                            }
                            break outerLoop
                        }
                        ;[contents] = createStore(child) // WHY add semicolons? https://web.archive.org/web/20120615060024/inimino.org/%7Einimino/blog/javascript_semicolons#:~:text=a%20string%22.length-,Unfortunately,-%2C%20there%20are%20five
                        break
                    }
                }
            }
        }
    }

    const isUnzipComplated = (id: number) => {
        const count = files.files.find(f => f.id === id)?.count
        if (!count) return false
        return (count.dir[1] > 0 || count.file[1] > 0) && count.dir[0] === count.dir[1] && count.file[0] === count.file[1]
    }

    const removeArchive = (path: string) => {
        const fileStore = files.files.find(f => f.path === path)
        const paths = fileStore?.multiVolume ? fileStore.multiVolume.volumes : path

        setFiles(
            'files',
            files.files.filter(f => f.path !== path),
        )
        setUnzipedPaths(unzipedPaths.filter(p => p !== paths))
        if (recentlyUnzipedPath() === paths) {
            setRecentlyUnzipedPath('')
        }
        setExpandedItem(prev => prev.filter(item => item !== `item-${fileStore?.id}`))
    }

    const refreshArchive = async (path: string) => {
        const file = files.files.find(f => f.path === path)
        setFiles(
            'files',
            file => file.path === path,
            produce(file => {
                Object.assign(file, defaultArchiveExtend)
                file.contents = defaultFileTree
            }),
        )
        const unlisten = await events.showArchiveContentsEvent.listen(event => onDragDrop(event))
        await commands.refreshArchiveContents(file as Archive, password()).finally(() => unlisten())
    }

    const handleSetCodepage = (path: string, codepage: Codepage | null) => {
        setFiles('files', file => file.path === path, 'codepage', codepage)
    }

    return (
        <Grid class={cn(props.class, 'm-2', 'grid-rows-[auto_auto_minmax(0,1fr)]')}>
            <Label class="basis-full my-2 font-semibold leading-none">压缩内容</Label>
            <UnzipControl
                files={files}
                unzipedPaths={unzipedPaths}
                recentlyUnzipedPath={recentlyUnzipedPath()}
                onUnzipedArchive={handleUnzipedFile}
                onRemove={removeArchive}
            />
            <Accordion multiple value={expandedItem()} onChange={setExpandedItem} class="mt-4 overflow-auto scrollbar-none">
                <For each={files.files}>
                    {item => (
                        <AccordionItem value={`item-${item.id}`} class="">
                            <AccordionTrigger class="w-full hover:decoration-none">
                                <Flex justifyContent="start" class="flex-wrap min-w-50% gap-1 text-xs">
                                    <Tooltip fitViewport={true}>
                                        {/* placement start&end error. */}
                                        <TooltipTrigger
                                            as="span"
                                            class="basis-full text-align-left text-sm font-semibold truncate hover:(inline-flex)"
                                            classList={{ 'color-violet-400': isUnzipComplated(item.id) }}
                                        >
                                            {item.path.split(/[\\\/]/).pop()}
                                        </TooltipTrigger>
                                        <TooltipContent class="text-xs text-wrap">{item.path}</TooltipContent>
                                    </Tooltip>
                                    <Separator />
                                    <span class="text-muted-foreground">{`📁 ${item.count.dir[1]}/${item.count.dir[0]}`}</span>
                                    <span class="text-muted-foreground">{`📄 ${item.count.file[1]}/${item.count.file[0]}`}</span>

                                    <Show when={item.multiVolume}>
                                        {value => (
                                            <Tooltip>
                                                <TooltipTrigger as={Badge} variant="outline" class="">
                                                    分卷：{value().volumes.length}
                                                </TooltipTrigger>
                                                <TooltipContent class="text-xs">
                                                    <For each={value().volumes}>{volume => <div>{volume.split(/[\\\/]/).pop()}</div>}</For>
                                                </TooltipContent>
                                            </Tooltip>
                                        )}
                                    </Show>
                                </Flex>
                                <Switch
                                    fallback={
                                        <RefreshArchiveButton
                                            onRefresh={() => refreshArchive(item.path)}
                                            class="flex-shrink-0"
                                            disabled={item.unzipStatus === 'Running'}
                                        />
                                    }
                                >
                                    <Match when={item.unzipStatus === 'Running'}>
                                        <LoadingArchiveButton type="long" class="flex-shrink-0" />
                                    </Match>
                                </Switch>

                                <RemoveArchiveButton
                                    onRemove={() => removeArchive(item.path)}
                                    class="flex-shrink-0"
                                    disabled={files.files.some(f => f.unzipStatus === 'Running')}
                                />
                            </AccordionTrigger>
                            <AccordionContent>
                                <CodepageButton
                                    codepage={item.codepage}
                                    setCodepage={(codepage: Codepage | null) => handleSetCodepage(item.path, codepage)}
                                    onRefresh={() => refreshArchive(item.path)}
                                />
                                <Show when={item.password}>
                                    <Badge class="">{item.password}</Badge>
                                </Show>
                                <Show when={item.unzippingFile}>
                                    <span class="text-muted-foreground">Unzipping: {item.unzippingFile}</span>
                                </Show>
                                   <span>{item.hasRootDir ? '📂' : '📄'}</span> 
                                <Accordion collapsible>
                                    <Index each={item.hasRootDir ?item.contents.children : [item.contents] }>
                                        {child => <ArchiveContent contents={child()} />}
                                    </Index>
                                </Accordion>
                            </AccordionContent>
                        </AccordionItem>
                    )}
                </For>
            </Accordion>
        </Grid>
    )
}

export default ArchiveContents
