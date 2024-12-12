import type { Component } from 'solid-js'

import { Flex } from '~/components/ui/flex'
import { Password } from './Password'
import { TargetDir } from './TargetDir'

export const UnzipSetting: Component = () => {
    return (
        <Flex flexDirection="col" alignItems="stretch" justifyContent="start" class="flex-1 <lg:max-w-full max-w-[1fr] min-w-xs p-2 gap-2">
            <TargetDir />
            <Password />
        </Flex>
    )
}
