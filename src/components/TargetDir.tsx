import { open } from '@tauri-apps/plugin-dialog'
import { type Component, type ContextProviderComponent, createContext, createEffect, createSignal, Show, useContext } from 'solid-js'

import { Button } from '~/components/ui/button'
import { Flex } from '~/components/ui/flex'
import { TextField, TextFieldInput, TextFieldLabel } from '~/components/ui/text-field'
import { Toggle } from '~/components/ui/toggle'
import { Tooltip, TooltipContent, TooltipTrigger } from '~/components/ui/tooltip'
import { useAppConfig } from './Config'

export const makeTargetDirContext = (dir: string) => {
    return createSignal(dir)
}
type TargetDirContextType = ReturnType<typeof makeTargetDirContext>

export const TargetDirContext = createContext<TargetDirContextType>()

export const TargetDirProvider: ContextProviderComponent<TargetDirContextType> = props => {
    return <TargetDirContext.Provider value={props.value}>{props.children}</TargetDirContext.Provider>
}

export function useTargetDir() {
    const targetDir = useContext(TargetDirContext)
    if (!targetDir) {
        throw new Error('useTargetDirContext should be called inside its ContextProvider')
    }
    return targetDir
}

export const TargetDir: Component = () => {
    const [appConfig, setAppConfig] = useAppConfig()
    const [targetDir, setTargetDir] = useTargetDir()
    const [canInput, setCanInput] = createSignal(appConfig.target.canInput)

    createEffect(() => {
        createEffect(() => setAppConfig('target', { dir: targetDir() }))
        createEffect(() => setAppConfig('target', { canInput: canInput() }))
    })

    let input: HTMLInputElement | undefined

    const dir = async () => {
        const path = await open({
            multiple: false,
            directory: true,
        })
        if (path) {
            setTargetDir(path)
        }
    }

    const switchReadonly = () => {
        setCanInput(prev => !prev)
        if (input && canInput()) {
            input.focus()
        }
    }

    return (
        <form onSubmit={e => e.preventDefault()}>
            <TextField value={targetDir()} onChange={setTargetDir} readOnly={!canInput()}>
                <Flex class="flex-wrap">
                    <TextFieldLabel class="basis-full lg:basis-full sm:basis-auto my-2 font-semibold mr-2">解压路径</TextFieldLabel>
                    <Flex class="flex-1">
                        <TextFieldInput type="text" ref={input} class="pr-20" />
                        <Flex justifyContent="end" class="w-auto ml-[-100%] mr-1">
                            <Tooltip>
                                <TooltipTrigger as={Button} type="reset" variant="ghost" size="sm" class="text-base px-2 w-9">
                                    <div class="i-material-symbols-light-clear-all-rounded" />
                                </TooltipTrigger>
                                <TooltipContent>
                                    {/* <TooltipArrow /> WHY NOT WORK！*/}
                                    清空路径
                                </TooltipContent>
                            </Tooltip>
                            <Toggle pressed={canInput()} onChange={switchReadonly} as="div" tabIndex={-1} class="px-0">
                                {state => (
                                    <Tooltip>
                                        <TooltipTrigger as={Button} type="button" variant="ghost" size="sm" class="text-base px-2 w-9">
                                            <Show
                                                when={state.pressed()}
                                                fallback={<div class="i-material-symbols-light-edit-off-outline-rounded" />}
                                            >
                                                <div class="i-material-symbols-light-edit-outline-rounded" />
                                            </Show>
                                        </TooltipTrigger>
                                        <TooltipContent>{state.pressed() ? 'Edit' : 'Edit Off'}</TooltipContent>
                                    </Tooltip>
                                )}
                            </Toggle>
                        </Flex>
                    </Flex>
                    <Button onClick={dir} class="ml-2 min-w-20">
                        选择
                    </Button>
                </Flex>
            </TextField>
        </form>
    )
}
