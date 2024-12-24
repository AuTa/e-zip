import { ColorModeProvider, ColorModeScript, createLocalStorageManager } from '@kobalte/core'
import { createResource, Match, type ParentComponent, Switch } from 'solid-js'

import { Flex } from '~/components/ui/flex'
import { SidebarProvider, SidebarTrigger } from '~/components/ui/sidebar'
import { AppSidebar } from './components/AppSidebar'
import { ArchiveContentsComponent } from './components/ArchiveContents'
import { AppConfigProvider, makeAppConfigContext } from './components/Config'
import { makePasswordInputContext, PasswordInputProvider } from './components/Password'
import { makeTargetDirContext, TargetDirProvider } from './components/TargetDir'

import './App.css'
import { Grid } from './components/ui/grid'
import { ThemeSelector } from './components/ThemeSelector'

const App: ParentComponent = props => {
    const storageManager = createLocalStorageManager('kb-color-mode')

    const [appConfig] = createResource(async () => {
        return await makeAppConfigContext()
    })

    return (
        <>
            <ColorModeScript storageType={storageManager.type} />
            {/* context. */}
            <ColorModeProvider storageManager={storageManager}>
                <SidebarProvider>
                    <AppSidebar />
                    <main class="w-full h-full scrollbar-none">
                        <Grid class="grid-rows-[auto_minmax(0,1fr)] h-screen">
                            <Flex>
                                <SidebarTrigger />
                                <ThemeSelector />
                            </Flex>
                            <Switch>
                                <Match when={appConfig()}>
                                    {value => (
                                        <AppConfigProvider value={value()}>
                                            <TargetDirProvider value={makeTargetDirContext(value()[0].target.dir)}>
                                                <PasswordInputProvider value={makePasswordInputContext()}>
                                                    <Grid class="<lg:grid-rows-[auto_auto_minmax(0,1fr)] lg:grid-cols-[2fr_auto_3fr] lg:grid-rows-[minmax(0,1fr)]">
                                                        {props.children}
                                                        <hr class="border-t-0 h-px w-full bg-gradient-to-r lg:w-px lg:h-full lg:bg-gradient-to-b from-transparent to-transparent via-border" />
                                                        <ArchiveContentsComponent class="" />
                                                    </Grid>
                                                </PasswordInputProvider>
                                            </TargetDirProvider>
                                        </AppConfigProvider>
                                    )}
                                </Match>
                            </Switch>
                        </Grid>
                    </main>
                </SidebarProvider>
            </ColorModeProvider>
        </>
    )
}

export default App
