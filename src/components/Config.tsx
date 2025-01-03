import {
    type Accessor,
    createContext,
    createEffect,
    createResource,
    createSignal,
    type FlowComponent,
    Match,
    onMount,
    type Setter,
    Switch,
    useContext,
} from 'solid-js'
import { createStore, type SetStoreFunction } from 'solid-js/store'

import { type AppConfig, commands, type Target } from '../bindings'

export const makeAppConfigContext = async () => {
    const result = await commands.initConfig()

    if (result.status === 'error') {
        throw new Error(result.error)
    }

    return createStore<AppConfig>(result.data)
}
type AppConfigContextType = {
    target: Accessor<Target>
    setTarget: SetStoreFunction<Target>
    passwords: Accessor<string[]>
    setPasswords: SetStoreFunction<string[]>
    autoDelete: Accessor<boolean>
    setAutoDelete: Setter<boolean>
}

export const AppConfigContext = createContext<AppConfigContextType>()

export const AppConfigProvider: FlowComponent = props => {
    const [appConfig] = createResource(async () => {
        const result = await commands.initConfig()
        if (result.status === 'error') {
            throw new Error(result.error)
        }
        return result.data
    })
    const [configStore, setAppConfig] = createStore<AppConfig>({ target: { dir: '', canInput: false }, passwords: [], autoDelete: false })

    const [, setTarget] = createStore(configStore.target)
    const [, setPasswords] = createStore(configStore.passwords)

    const config: AppConfigContextType = {
        target: () => configStore.target,
        setTarget: setTarget,
        passwords: () => configStore.passwords,
        setPasswords: setPasswords,
        autoDelete: () => configStore.autoDelete,
        setAutoDelete: setter => setAppConfig('autoDelete', setter),
    }

    const [inited, setInited] = createSignal(false)

    createEffect(() => {
        if (inited()) {
            configStore.target
            configStore.passwords
            configStore.autoDelete
            commands.updateConfig(configStore)
        }
    })

    onMount(async () => {
        const ac = appConfig()
        if (!ac) return

        config.setTarget(ac.target)
        config.setPasswords(ac.passwords)
        config.setAutoDelete(ac.autoDelete)

        setInited(true)
    })
    return (
        <Switch>
            <Match when={appConfig.loading}>
                <div>Loading...</div>
            </Match>
            <Match when={appConfig.error}>
                <AppConfigContext.Provider value={config}>{props.children}</AppConfigContext.Provider>
                <span>{appConfig.error.message}</span>
            </Match>
            <Match when={appConfig()}>
                {value => {
                    config.setAutoDelete(value().autoDelete)
                    config.setPasswords(value().passwords)
                    config.setTarget(value().target)
                    setInited(true)
                    return <AppConfigContext.Provider value={config}>{props.children}</AppConfigContext.Provider>
                }}
            </Match>
        </Switch>
    )
}

export function useAppConfig() {
    const appConfig = useContext(AppConfigContext)
    if (!appConfig) {
        throw new Error('useAppConfigContext should be called inside its ContextProvider')
    }
    return appConfig
}
