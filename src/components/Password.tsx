import { Label as ComboboxLabel } from '@kobalte/core/combobox'
import { createContext, createSignal, useContext, type Component, type ContextProviderComponent } from 'solid-js'
import { createStore } from 'solid-js/store'

import { Button } from '~/components/ui/button'
import {
    Combobox,
    ComboboxContent,
    ComboboxControl,
    ComboboxInput,
    ComboboxItem,
    ComboboxItemIndicator,
    ComboboxItemLabel,
    ComboboxTrigger,
} from '~/components/ui/combobox'
import { Flex } from '~/components/ui/flex'
import { labelVariants } from '~/components/ui/text-field'
import { Tooltip, TooltipContent, TooltipTrigger } from '~/components/ui/tooltip'
import { cn } from '~/lib/utils'
import { useAppConfig } from './Config'

export const makePasswordInputContext = () => {
    return createSignal('')
}
type PasswordInputContextType = ReturnType<typeof makePasswordInputContext>

export const PasswordInputContext = createContext<PasswordInputContextType>()

export const PasswordInputProvider: ContextProviderComponent<PasswordInputContextType> = props => {
    return <PasswordInputContext.Provider value={props.value}>{props.children}</PasswordInputContext.Provider>
}

export function usePasswordInput() {
    const passwordInput = useContext(PasswordInputContext)
    if (!passwordInput) {
        throw new Error('useTargetDirContext should be called inside its ContextProvider')
    }
    return passwordInput
}

export const Password: Component = () => {
    const [appConfig] = useAppConfig()
    const [passwords, setPasswords] = createStore(appConfig.passwords)

    const [password, setPassword] = usePasswordInput()

    const onInputChange = (value: string) => {
        setPassword(value)
    }

    const addPassword = () => {
        if (passwords.includes(password())) return
        setPasswords([...passwords, password()])
    }

    const removePassword = () => {
        setPasswords(passwords.filter(p => p !== password()))
        setPassword('')
    }

    return (
        <form onSubmit={e => e.preventDefault()}>
            <Combobox
                name="passwords"
                options={passwords}
                onInputChange={onInputChange}
                placeholder="Password..."
                itemComponent={props => (
                    <ComboboxItem item={props.item}>
                        <ComboboxItemLabel>{props.item.rawValue}</ComboboxItemLabel>
                        <ComboboxItemIndicator />
                    </ComboboxItem>
                )}
            >
                <Flex class="flex-wrap">
                    <ComboboxLabel
                        class={cn(
                            labelVariants(),
                            'basis-full',
                            'lg:basis-full',
                            'sm:basis-auto',
                            'my-2',
                            'font-semibold',
                            'mr-2',
                            'flex-shrink-0',
                        )}
                    >
                        密码列表
                    </ComboboxLabel>
                    <Flex class="flex-1">
                        {/* Control 没有设置高度，Input 设置了高度，但是 border 在 Control 上导致变高了一点。 */}
                        <ComboboxControl
                            aria-label="Password"
                            class="w-full ring-offset-background focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 h-10 border-input"
                        >
                            <ComboboxInput value={password()} class="pr-13 py-2" />
                            <ComboboxTrigger />
                        </ComboboxControl>
                        <ComboboxContent />
                        <Tooltip>
                            <TooltipTrigger
                                as={Button}
                                onClick={removePassword}
                                variant="ghost"
                                size="sm"
                                class="text-base px-2 ml-[-100%] mr-10 w-9"
                            >
                                <div class="i-material-symbols-light-delete-outline-rounded" />
                            </TooltipTrigger>
                            <TooltipContent>Delete Password!</TooltipContent>
                        </Tooltip>
                    </Flex>
                    <Button onClick={addPassword} class="ml-2 min-w-20">
                        Add
                    </Button>
                </Flex>
            </Combobox>
        </form>
    )
}
