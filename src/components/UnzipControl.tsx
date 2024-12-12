import type { Component } from 'solid-js'

import { UnzipButton } from './UnzipButton'
import { RemoveAllArchiveButton } from './RemoveAllArchiveButton'
import { DeleteUnzipedArchiveButton } from './DeleteUnzipedArchiveButton'
import type { FileStore } from './ArchiveContents'
import type { Archive, UnzipedArchiveEvent } from '~/bindings'
import { Flex } from './ui/flex'

export const UnzipControl: Component<{
    files: {
        files: FileStore[]
    }
    unzipedPaths: string[]
    recentlyUnzipedPath: string
    onUnzipedArchive: (event: UnzipedArchiveEvent) => void
    onRemove: (path: string) => void
}> = props => {
    return (
        <Flex alignItems="start" justifyContent="start" class="gap-2">
            <UnzipButton archives={props.files.files.map(f => f as Archive)} onUnzipedArchive={props.onUnzipedArchive} />
            <RemoveAllArchiveButton paths={props.files.files.map(f => f.path)} onRemove={props.onRemove} />
            <DeleteUnzipedArchiveButton
                paths={props.unzipedPaths}
                recentlyUnzipedPath={props.recentlyUnzipedPath}
                onRemove={props.onRemove}
            />
        </Flex>
    )
}
