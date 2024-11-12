import type { Component } from 'solid-js'

import { type Archive, commands, events, type UnzipedArchiveEvent } from '../bindings'
import { Button } from '~/components/ui/button'
import { usePasswordInput } from './Password'

export const UnzipButton: Component<{
    archives: Archive[]
    targetDir: string
    onUnzipedArchive: (event: UnzipedArchiveEvent) => void
}> = props => {
    const [password] = usePasswordInput()

    async function handleClick() {
        const unlisten = await events.unzipedArchiveEvent.listen(e => props.onUnzipedArchive(e.payload))
        await commands.unzipArchives(props.archives, props.targetDir, password()).then(() => {
            unlisten()
        })
    }

    return (
        <Button on:click={handleClick} type="button">
            Unzip
        </Button>
    )
}
