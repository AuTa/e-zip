import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '~/components/ui/sidebar'
import { SevenZipVersion } from './SevenZipVersion'

import './AppSidebar.css'
import { A } from '@solidjs/router'

export function AppSidebar() {
    return (
        <Sidebar collapsible="icon" class="[&>div:first-child]:bg-opacity-10">
            <SidebarHeader>
                <SidebarMenuButton size="lg">
                    <div class="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                        <div class="i-material-symbols-light-e-mobiledata-badge-outline-rounded text-base" />
                    </div>
                    <span>Welcome to E-Zip</span>
                </SidebarMenuButton>
            </SidebarHeader>
            <SidebarContent>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton as={A} href="/">
                            <div class="flex aspect-square size-6 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                                7Z
                            </div>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarContent>
            <SidebarFooter>
                <SidebarMenuButton class="text-xs">
                    <div class="flex aspect-square size-6 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                        7Z
                    </div>
                    <SevenZipVersion />
                </SidebarMenuButton>
            </SidebarFooter>
        </Sidebar>
    )
}
