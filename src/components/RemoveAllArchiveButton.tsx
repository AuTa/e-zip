import type { Component } from 'solid-js'

import { Button } from '~/components/ui/button'

export const RemoveAllArchiveButton: Component<{ paths: string[]; onRemove: (path: string) => void }> = props => {  
    return <Button on:click={()=> props.paths.map(path => props.onRemove(path))}>移除全部</Button>
}
