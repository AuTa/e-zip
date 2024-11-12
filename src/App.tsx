import { ColorModeProvider, ColorModeScript, createLocalStorageManager } from '@kobalte/core'
import { invoke } from '@tauri-apps/api/core'
import { createResource, createSignal, Match, Show, Switch } from 'solid-js'

import { Button } from '~/components/ui/button'
import { commands } from './bindings'
import { ArchiveContents } from './components/ArchiveContents'
import { AppConfigProvider, makeAppConfigContext } from './components/Config'
import { makePasswordInputContext, Password, PasswordInputProvider } from './components/Password'
import { makeTargetDirContext, TargetDir, TargetDirProvider } from './components/TargetDir'

import './App.css'

function App() {
    const storageManager = createLocalStorageManager('vite-ui-theme')

    const [sevenZipVersion, setSevenZipVersion] = createSignal('')
    const [hasSevenZip, setHasSevnezip] = createSignal(true)

    async function check7zVersion() {
        const version = await commands.check7zVersion()
        if (version.status === 'error') {
            console.error(version.error)
            setHasSevnezip(false)
        } else {
            setSevenZipVersion(version.data)
        }
    }

    check7zVersion()

    async function downloadSevenZip() {
        console.log('downloadSevenZip')
        const result = await commands.download7z()
        console.log(result)
        check7zVersion()
    }

    const [appConfig] = createResource(async () => {
        return await makeAppConfigContext()
    })

    return (
        <>
            <ColorModeScript storageType={storageManager.type} />
            {/* context. */}
            <ColorModeProvider storageManager={storageManager}>
                <main class="container chinese">
                    <h1>Welcome to Tauri + Solid</h1>
                    <Switch>
                        <Match when={appConfig()}>
                            {value => (
                                <AppConfigProvider value={value()}>
                                    <TargetDirProvider value={makeTargetDirContext(value()[0].target.dir)}>
                                        <TargetDir />
                                        <PasswordInputProvider value={makePasswordInputContext()}>
                                            <Password />
                                            <ArchiveContents />
                                        </PasswordInputProvider>
                                    </TargetDirProvider>
                                </AppConfigProvider>
                            )}
                        </Match>
                    </Switch>
                    <p>{sevenZipVersion()}</p>
                    <Show when={!hasSevenZip()}>
                        7z not found.<Button onClick={downloadSevenZip}>Download</Button>
                    </Show>
                </main>
            </ColorModeProvider>
        </>
    )
}

export default App
