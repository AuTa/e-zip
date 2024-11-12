import { type ContextProviderComponent, createContext, createEffect, createResource, useContext } from 'solid-js'
import { createStore } from 'solid-js/store'

import { type AppConfig, commands } from '../bindings'

export const makeAppConfigContext = async () => {
    const result = await commands.initConfig()

    if (result.status === 'error') {
        throw new Error(result.error)
    }

    return createStore<AppConfig>(result.data)
}
type AppConfigContextType = Awaited<ReturnType<typeof makeAppConfigContext>>

export const AppConfigContext = createContext<AppConfigContextType>()

export const AppConfigProvider: ContextProviderComponent<AppConfigContextType> = props => {
    createEffect(() => {
        commands.updateConfig(props.value[0])
    })
    return <AppConfigContext.Provider value={props.value}>{props.children}</AppConfigContext.Provider>
}

export function useAppConfig() {
    const appConfig = useContext(AppConfigContext)
    if (!appConfig) {
        throw new Error('useAppConfigContext should be called inside its ContextProvider')
    }
    return appConfig
}
