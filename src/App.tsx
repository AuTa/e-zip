import { invoke } from '@tauri-apps/api/core'
import { listen, once, TauriEvent } from '@tauri-apps/api/event'
import { createSignal } from 'solid-js'

import { ArchiveContents } from './components/Archive-Contents'
 
import './App.css'

function App() {
    const [greetMsg, setGreetMsg] = createSignal('')
    const [name, setName] = createSignal('')

    const [sevenZipVersion, setsevenZipVersion] = createSignal('')

    async function greet() {
        // Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
        setGreetMsg(await invoke('greet', { name: name() }))
    }

    async function check7zVersion() {
        setsevenZipVersion(await invoke('check_7z_version'))
    }

    check7zVersion()

    return (
        <main class="container">
            <h1>Welcome to Tauri + Solid</h1>

            <p>Click on the Tauri, Vite, and Solid logos to learn more.</p>

            <form
                class="row"
                onSubmit={(e) => {
                    e.preventDefault()
                    greet()
                }}
            >
                <input
                    id="greet-input"
                    onChange={(e) => setName(e.currentTarget.value)}
                    placeholder="Enter a name..."
                />
                <button type="submit">Greet</button>
            </form>
            <p>{greetMsg()}</p>

            <ArchiveContents />

            <p>{sevenZipVersion()}</p>
        </main>
    )
}

export default App
