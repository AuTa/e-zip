import { TauriEvent, listen } from '@tauri-apps/api/event'
import { type ComponentProps, Index, Show, createSignal, type Component } from 'solid-js'
import { createStore, produce } from 'solid-js/store'

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '~/components/ui/accordion'
import { Badge } from '~/components/ui/badge'
import { Flex } from '~/components/ui/flex'
import { Label } from '~/components/ui/label'
import { Separator } from '~/components/ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from '~/components/ui/tooltip'
import { commands, type Archive, type ArchiveTree, type Codepage, type FsNode, type UnzipedArchiveEvent } from '../bindings'
import { ArchiveContent } from './ArchiveContent'
import { CodepageButton } from './CodepageButton'
import { usePasswordInput } from './Password'
import { RefreshArchiveButton } from './RefreshArchiveButton'
import { RemoveArchiveButton } from './RemoveArchiveButton'
import { useTargetDir } from './TargetDir'
import { cn } from '~/lib/utils'
import { Grid } from './ui/grid'
import { UnzipControl } from './UnzipControl'

// biome-ignore lint/style/useNamingConvention: <explanation>
type Result<T, E> = { Ok?: T; Error?: E }

export type FileContents = {
    value: FsNode
    children: FileContents[]
    unziped: boolean
}

type DragDropFileContentsResult = Result<DragDropFileContents, string>

type DragDropFileContents = ArchiveTree & {
    tree: FileContents
}
type ArchiveExtend = {
    contents: FileContents
    count: FileCounter
    unzippingFile: string
}

export type FileStore = ArchiveTree & ArchiveExtend

function newArchiveExtend(): ArchiveExtend {
    return {
        contents: { value: { type: 'None' }, children: [], unziped: false },
        count: createFileCount(),
        unzippingFile: '',
    }
}
function newFileStore(path: string): FileStore {
    return {
        path,
        password: null,
        codepage: null,
        ...newArchiveExtend(),
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

export const ArchiveContents: Component<ComponentProps<'div'>> = props => {
    const [files, setFiles] = createStore({ files: [] as FileStore[] })
    const [unzipedPaths, setUnzipedPaths] = createStore([] as string[])
    const [recentlyUnzipedPath, setRecentlyUnzipedPath] = createSignal('')
    const [password] = usePasswordInput()

    listen(TauriEvent.DRAG_DROP, async event => {
        const payload = event.payload as { paths: string[]; position: { x: number; y: number } }
        const { paths } = payload
        const path2Files = paths.filter(p => !files.files.some(f => f.path === p)).map(p => newFileStore(p))
        setFiles('files', [...files.files, ...path2Files])
        await commands.showArchivesContents(paths, password())
    })

    listen('drag_drop_file_contents', event => {
        const result = event.payload as DragDropFileContentsResult
        const contents = result.Ok
        if (contents !== undefined) {
            setFiles(
                'files',
                f => f.path === contents.path,
                produce(file => {
                    file.password = contents.password
                    file.contents = contents.tree
                    file.codepage = contents.codepage
                    file.count = handleFileCount(contents.tree)
                }),
            )
        }
    })

    const handleFileCount = (contents: FileContents): FileCounter => {
        const count = createFileCount()
        // 如果没有根文件夹, 解压的时候会添加.
        if (contents.children.length > 1) {
            count.dir[0] += 1
        }
        const handleSetCount = (contents: FileContents) => {
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
                // TODO: show loading
                return
            }
            if (unzipedArchiveStatus === 'Completed') {
                const index = files.files.findIndex(f => f.path === archivePath)
                if (index === -1) {
                    return
                }
                const fileStore = files.files[index]
                if (isUnzipComplated(index)) {
                    setUnzipedPaths(unzipedPaths.length, fileStore.path)
                    setRecentlyUnzipedPath(fileStore.path)
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
                const addRootDir = i === 0 && contents.children.length > 1
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

    const [targetDir] = useTargetDir()

    const isUnzipComplated = (index: number) => {
        const count = files.files[index].count
        return (count.dir[1] > 0 || count.file[1] > 0) && count.dir[0] === count.dir[1] && count.file[0] === count.file[1]
    }

    const removeArchive = (path: string) => {
        setFiles(
            'files',
            files.files.filter(f => f.path !== path),
        )
        setUnzipedPaths(unzipedPaths.filter(p => p !== path))
        if (recentlyUnzipedPath() === path) {
            setRecentlyUnzipedPath('')
        }
    }

    const refreshArchive = async (path: string) => {
        const file = files.files.find(f => f.path === path)
        setFiles(
            'files',
            file => file.path === path,
            produce(file => {
                const extend = newArchiveExtend()
                Object.assign(file, extend)
                // file.contents = { value: { type: 'None' }, children: [], unziped: false }
                // file.count = createFileCount()
                // file.unzippingFile = ''
            }),
        )
        await commands.refreshArchiveContents(file as Archive, password())
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
            <Accordion collapsible defaultValue={['item-0']} class="mt-4 overflow-auto scrollbar-none">
                <Index each={files.files}>
                    {(item, index) => (
                        <AccordionItem value={`item-${index}`} class="">
                            <AccordionTrigger class="w-full hover:decoration-none">
                                <Flex justifyContent="start" class="flex-wrap min-w-50% gap-2 text-xs">
                                    <Tooltip>
                                        {/* placement start&end error. */}
                                        <TooltipTrigger
                                            as="span"
                                            class="basis-full text-align-left text-sm font-semibold truncate hover:(inline-flex)"
                                            classList={{ 'color-violet-400': isUnzipComplated(index) }}
                                        >
                                            {item()
                                                .path.split(/[\\\/]/)
                                                .pop()}
                                        </TooltipTrigger>
                                        <TooltipContent>{item().path}</TooltipContent>
                                    </Tooltip>
                                    <Separator />
                                    <span class="text-muted-foreground">{`📁 ${item().count.dir[1]}/${item().count.dir[0]}`}</span>
                                    <span class="text-muted-foreground">{`📄 ${item().count.file[1]}/${item().count.file[0]}`}</span>

                                    <CodepageButton
                                        codepage={item().codepage}
                                        setCodepage={(codepage: Codepage | null) => handleSetCodepage(item().path, codepage)}
                                        onRefresh={() => refreshArchive(item().path)}
                                    />
                                    <Show when={item().password}>
                                        <Badge class="">{item().password}</Badge>
                                    </Show>
                                    <Show when={item().unzippingFile}>
                                        <span class="text-muted-foreground">Unzipping: {item().unzippingFile}</span>
                                    </Show>
                                </Flex>
                                <RefreshArchiveButton onRefresh={() => refreshArchive(item().path)} class="flex-shrink-0" />
                                <RemoveArchiveButton onRemove={() => removeArchive(item().path)} class="flex-shrink-0" />
                            </AccordionTrigger>
                            <AccordionContent>
                                <Accordion collapsible>
                                    <Index each={item().contents.children.length > 1 ? [item().contents] : item().contents.children}>
                                        {child => <ArchiveContent contents={child()} />}
                                    </Index>
                                </Accordion>
                            </AccordionContent>
                        </AccordionItem>
                    )}
                </Index>
            </Accordion>
        </Grid>
    )
}

export default ArchiveContents
