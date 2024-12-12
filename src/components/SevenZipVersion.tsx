import { createResource, Match, Show, Switch, type Component } from 'solid-js'
import { commands } from '~/bindings'
import { Button } from '~/components/ui/button'

export const SevenZipVersion: Component = () => {
    const [version, { refetch: refetchVerison }] = createResource(async () => {
        const version = await commands.check7zVersion()
        if (version.status === 'error') {
            console.error(version.error)
            throw new Error('NotFound7z')
        }
        return version.data
    })

    async function downloadSevenZip() {
        console.log('downloadSevenZip')
        const result = await commands.download7z()
        console.log(result)
        refetchVerison()
    }

    const versionShort = () => version()?.split(': C')[0]

    return (
        <>
            <Show when={version.loading}>
                <p>Loading...</p>
            </Show>
            <Switch>
                <Match when={version.error}>
                    <p>
                        7z not found.<Button onClick={downloadSevenZip}>Download</Button>
                    </p>
                </Match>
                <Match when={version()}>
                    <p>{versionShort()}</p>
                </Match>
            </Switch>
        </>
    )
}
