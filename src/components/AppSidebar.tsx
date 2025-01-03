import { createMediaQuery } from '@solid-primitives/media'
import { A } from '@solidjs/router'
import { createEffect } from 'solid-js'
import type { PresetUnoTheme } from 'unocss'

import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    useSidebar,
} from '~/components/ui/sidebar'
import { SevenZipVersion } from './SevenZipVersion'

import './AppSidebar.css'

export function AppSidebar() {
    const theme = import.meta.env.__UNO_THEME__ as PresetUnoTheme
    const isSmall = createMediaQuery(`(max-width: ${theme.breakpoints?.md})`)
    const { open, toggleSidebar } = useSidebar()

    createEffect(() => {
        if (isSmall() && open()) {
            toggleSidebar()
        }
    })

    return (
        <div class="[&>div:first-child]:block [&>div>div:last-child]:flex">
            <Sidebar variant="floating" collapsible="icon" class="[&>div:first-child]:bg-opacity-10">
                <SidebarHeader>
                    <SidebarMenuButton size="lg">
                        <div class="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                            <div class="i-material-symbols-light-e-mobiledata-badge-outline-rounded text-base" />
                        </div>
                        <span>Welcome to E-Zip</span>
                    </SidebarMenuButton>
                </SidebarHeader>
                <SidebarContent>
                    <SidebarGroup>
                        <SidebarMenu>
                            <SidebarMenuItem>
                                <SidebarMenuButton as={A} href="/">
                                    <div class="flex aspect-square size-4 items-center justify-center rounded-sm bg-sidebar-primary text-sidebar-primary-foreground">
                                        7Z
                                    </div>
                                    <span>设置</span>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        </SidebarMenu>
                    </SidebarGroup>
                </SidebarContent>
                <SidebarFooter>
                    <SidebarMenuButton as={A} href="/" class="text-xs">
                        <div class="flex aspect-square size-4 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
                            7Z
                        </div>
                        <SevenZipVersion />
                    </SidebarMenuButton>
                </SidebarFooter>
            </Sidebar>
        </div>
    )
}
