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
        <form>
            <Combobox
                name="passwords"
                options={passwords}
                onInputChange={onInputChange}
                placeholder="Select or enter a password..."
                itemComponent={props => (
                    <ComboboxItem item={props.item}>
                        <ComboboxItemLabel>{props.item.rawValue}</ComboboxItemLabel>
                        <ComboboxItemIndicator />
                    </ComboboxItem>
                )}
            >
                <Flex>
                    <ComboboxLabel class={cn(labelVariants(), 'w-20')}>密码列表</ComboboxLabel>
                    <Flex>
                        <ComboboxControl aria-label="Password" class="w-full">
                            <ComboboxInput value={password()} />
                            <ComboboxTrigger />
                        </ComboboxControl>
                        <ComboboxContent />
                        <Tooltip>
                            <TooltipTrigger
                                as={Button}
                                onClick={removePassword}
                                variant="ghost"
                                size="sm"
                                class="text-base px-2 ml-[-100%] mr-10"
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
