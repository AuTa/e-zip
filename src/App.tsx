import { ColorModeProvider, ColorModeScript, createLocalStorageManager } from '@kobalte/core/color-mode'
import type { ParentComponent } from 'solid-js'

import { Flex } from '~/components/ui/flex'
import { SidebarProvider, SidebarTrigger } from '~/components/ui/sidebar'
import { AppSidebar } from './components/AppSidebar'
import { ArchiveContentsComponent } from './components/ArchiveContents'
import { AppConfigProvider } from './components/Config'
import { makePasswordInputContext, PasswordInputProvider } from './components/Password'
import { makeTargetDirContext, TargetDirProvider } from './components/TargetDir'

import './App.css'
import { Grid } from './components/ui/grid'
import { ThemeSelector } from './components/ThemeSelector'

const App: ParentComponent = props => {
    const storageManager = createLocalStorageManager('kb-color-mode')

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

                            <AppConfigProvider>
                                <TargetDirProvider value={makeTargetDirContext()}>
                                    <PasswordInputProvider value={makePasswordInputContext()}>
                                        <Grid class="<lg:grid-rows-[auto_auto_minmax(0,1fr)] lg:grid-cols-[2fr_auto_3fr] lg:grid-rows-[minmax(0,1fr)]">
                                            {props.children}
                                            <hr class="border-t-0 h-px w-full bg-gradient-to-r lg:w-px lg:h-full lg:bg-gradient-to-b from-transparent to-transparent via-border" />
                                            <ArchiveContentsComponent class="" />
                                        </Grid>
                                    </PasswordInputProvider>
                                </TargetDirProvider>
                            </AppConfigProvider>
                        </Grid>
                    </main>
                </SidebarProvider>
            </ColorModeProvider>
        </>
    )
}

export default App
