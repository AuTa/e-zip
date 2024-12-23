import { Channel } from '@tauri-apps/api/core'
import type { Component, JSX } from 'solid-js'
import { createEffect, createSignal } from 'solid-js'

import { Button } from '~/components/ui/button'
import { Flex } from '~/components/ui/flex'
import { Select, SelectContent, SelectItem, SelectTrigger } from '~/components/ui/select'
import { type DeletedArchiveEvent, commands } from '../bindings'
import { useAppConfig } from './Config'

export const DeleteUnzipedArchiveButton: Component<{
    paths: (string | string[])[]
    recentlyUnzipedPath: (string | string[])
    onRemove: (path: string) => void
}> = props => {
    const [appConfig, setAppConfig] = useAppConfig()
    const [isAuto, setIsAuto] = createSignal(appConfig.autoDelete)

    createEffect(() => setAppConfig('autoDelete', isAuto()))

    const setAuto = (value: 'Auto' | 'Manual' | null) => {
        switch (value) {
            case 'Auto':
                setIsAuto(true)
                break
            case 'Manual':
                setIsAuto(false)
                break
        }
    }

    const deleteArchives = async (paths: (string | string[])[]) => {
        const onEvent = new Channel<DeletedArchiveEvent>()
        onEvent.onmessage = ([path, error]) => {
            if (error) {
                console.error(path, error)
            } else {
                props.onRemove(path)
            }
        }
        await commands.deleteArchives(paths.flat(), onEvent)
    }

    createEffect(() => {
        if (isAuto()) {
            createEffect(async () => {
                if (props.recentlyUnzipedPath) {
                    await deleteArchives([props.recentlyUnzipedPath])
                }
            })
        }
    })

    const deleteArchiveHandler: JSX.EventHandler<Element, Event> = async event => {
        event.stopPropagation()
        await deleteArchives(props.paths)
    }

    return (
        <Flex class="inline-flex w-auto">
            <Button on:click={deleteArchiveHandler} class="rounded-r-none">
                {isAuto() ? 'Auto' : 'Manual'}删除
            </Button>

            <Select
                value={isAuto() ? 'Auto' : 'Manual'}
                defaultValue={isAuto() ? 'Auto' : 'Manual'}
                onChange={setAuto}
                options={['Auto', 'Manual']}
                placement="bottom-end"
                itemComponent={props => <SelectItem item={props.item}>{props.item.rawValue}</SelectItem>}
            >
                <SelectTrigger
                    aria-label="isAuto"
                    class="bg-primary text-primary-foreground hover:bg-primary/90 rounded-l-none border-0 border-l 
                    focus-visible:(outline-none ring-2 ring-ring ring-offset-2) 
                    focus:outline-none-0 focus:ring-0 focus:ring-none focus:ring-offset-0"
                >
                    {/* <SelectValue<string>>{state => state.selectedOption()}</SelectValue> */}
                </SelectTrigger>
                <SelectContent />
            </Select>
        </Flex>
    )
}
