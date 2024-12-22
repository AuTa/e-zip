import type { Component } from 'solid-js'

import { type Archive, commands, events, type UnzipedArchiveEvent } from '../bindings'
import { Button } from '~/components/ui/button'
import { usePasswordInput } from './Password'
import { useTargetDir } from './TargetDir'

export const UnzipButton: Component<{
    archives: Archive[]
    onUnzipedArchive: (event: UnzipedArchiveEvent) => void
}> = props => {
    const [password] = usePasswordInput()
    const [targetDir] = useTargetDir()

    async function handleClick() {
        const unlisten = await events.unzipedArchiveEvent.listen(e => props.onUnzipedArchive(e.payload))
        await commands.unzipArchives(props.archives, targetDir(), password()).finally(() => unlisten())
    }

    return (
        <Button on:click={handleClick} type="button">
            Unzip
        </Button>
    )
}
