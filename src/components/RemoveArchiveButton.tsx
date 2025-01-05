import { splitProps, type Component, type ComponentProps, type JSX } from 'solid-js'

import { Button } from '~/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '~/components/ui/tooltip'
import { cn } from '~/lib/utils'

interface MyButtonProps extends ComponentProps<typeof Button> {
    onRemove: () => void
}

export const RemoveArchiveButton: Component<MyButtonProps> = props => {
    const onClick: JSX.EventHandler<Element, Event> = event => {
        event.stopPropagation()
        props.onRemove()
    }

    const [local, others] = splitProps(props, ['class', 'onRemove'])

    return (
        <Tooltip>
            <TooltipTrigger as={Button} onClick={onClick} variant="ghost" size="sm" class={cn('text-base px-2', local.class)} {...others}>
                <div class="i-material-symbols-light-clear-all-rounded" />
            </TooltipTrigger>
            <TooltipContent>Remove Archive</TooltipContent>
        </Tooltip>
    )
}
