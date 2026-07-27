"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { IconChevronRight, type Icon } from "@tabler/icons-react"
import { cn } from "@/lib/utils"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

type NavItem = {
  title: string
  url: string
  icon?: Icon
}

type NavGroup = {
  title: string
  icon?: Icon
  items: NavItem[]
}

function isActivePath(pathname: string, url: string) {
  return pathname === url || pathname.startsWith(url + "/")
}

function NavGroupAccordion({
  group,
  pathname,
}: {
  group: NavGroup
  pathname: string
}) {
  const isGroupActive = group.items.some((i) => isActivePath(pathname, i.url))
  // Default collapsed; auto-open only the group owning the current route.
  const [open, setOpen] = React.useState(isGroupActive)

  // Re-open when navigation moves into this group.
  React.useEffect(() => {
    if (isGroupActive) setOpen(true)
  }, [isGroupActive])

  const firstUrl = group.items[0]?.url || "#"

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <SidebarMenu>
        <SidebarMenuItem>
          <div
            className={cn(
              "flex items-center rounded-md transition-colors",
              isGroupActive && !open && "bg-sidebar-accent"
            )}
          >
            {/* Header navigates to the group's first screen */}
            <SidebarMenuButton
              asChild
              tooltip={group.title}
              className="flex-1 font-semibold"
            >
              <Link href={firstUrl} onClick={() => setOpen(true)}>
                {group.icon && <group.icon className="size-4" />}
                <span className="truncate">{group.title}</span>
              </Link>
            </SidebarMenuButton>

            {/* Chevron toggles without navigating */}
            <CollapsibleTrigger asChild>
              <button
                type="button"
                aria-label={(open ? "Collapse " : "Expand ") + group.title}
                className="mr-1 flex size-6 shrink-0 items-center justify-center rounded-sm text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground group-data-[collapsible=icon]:hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <IconChevronRight
                  className={cn(
                    "size-3.5 transition-transform duration-200",
                    open && "rotate-90"
                  )}
                />
              </button>
            </CollapsibleTrigger>
          </div>
        </SidebarMenuItem>
      </SidebarMenu>

      <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
        <SidebarMenu>
          <div
            className={cn(
              "relative ml-3 border-l-2 pl-0 transition-colors duration-200",
              isGroupActive ? "border-primary" : "border-border"
            )}
          >
            {group.items.map((item) => {
              const isActive = isActivePath(pathname, item.url)
              return (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    tooltip={item.title}
                    isActive={isActive}
                    className={cn(
                      "ml-2 transition-all duration-150",
                      isActive &&
                        "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground font-medium"
                    )}
                  >
                    <Link href={item.url}>
                      {item.icon && <item.icon className="size-4" />}
                      <span className="truncate">{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            })}
          </div>
        </SidebarMenu>
      </CollapsibleContent>
    </Collapsible>
  )
}

export function NavMain({
  items,
  groups,
}: {
  items: NavItem[]
  groups?: NavGroup[]
}) {
  const pathname = usePathname()

  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2">
        <SidebarMenu>
          {items.map((item) => {
            const isActive = isActivePath(pathname, item.url)
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton asChild tooltip={item.title} isActive={isActive}>
                  <Link href={item.url}>
                    {item.icon && <item.icon />}
                    <span className="truncate">{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>

        {groups?.map((group) => (
          <NavGroupAccordion key={group.title} group={group} pathname={pathname} />
        ))}
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
