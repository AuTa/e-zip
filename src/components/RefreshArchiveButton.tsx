import { splitProps, type Component, type ComponentProps, type JSX } from 'solid-js'

import { Button } from '~/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '~/components/ui/tooltip'
import { cn } from '~/lib/utils'

interface MyButtonProps extends ComponentProps<typeof Button> {
    onRefresh: () => void
}

export const RefreshArchiveButton: Component<MyButtonProps> = props => {
    const onClick: JSX.EventHandler<Element, Event> = event => {
        event.stopPropagation()
        props.onRefresh()
    }
    const [local] = splitProps(props, ['class'])

    return (
        <Tooltip>
            <TooltipTrigger as={Button} onClick={onClick} variant="ghost" size="sm" class={cn('text-base px-2', local.class)}>
                <div class="i-material-symbols-light-refresh-rounded" />
            </TooltipTrigger>
            <TooltipContent>Refresh Archive</TooltipContent>
        </Tooltip>
    )
}