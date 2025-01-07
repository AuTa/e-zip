import { splitProps, type Component, type ComponentProps } from 'solid-js'

import { Button } from '~/components/ui/button'
import { cn } from '~/lib/utils'
import { LoadingSpinner, type LoadingSpinnerProps } from './ui/loading-spinner'

type LoadingArchiveButtonProps = ComponentProps<typeof Button> & LoadingSpinnerProps

export const LoadingArchiveButton: Component<LoadingArchiveButtonProps> = props => {
    const [local, others] = splitProps(props, ['class', 'type'])

    return (
        <Button variant="ghost" size="sm" disabled class={cn('text-base px-2', local.class)} {...others}>
            <LoadingSpinner type={local.type} />
        </Button>
    )
}
