import { ChevronsUpDownIcon, LogOutIcon, UsersIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar'
import { useOp } from '@/lib/api'
import { lock } from '@/lib/session'
import { MemberAvatar } from './MemberAvatar'

// Sidebar header: the group and the member you act as. "Üye değiştir" locks: back to the member list, the next member enters their PIN (pin.md).
export function MemberMenu() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const settings = useOp('settings.get', {})
  const members = useOp('members.list', {})
  const me = members.data?.find((m) => m.me)

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger render={<SidebarMenuButton size="lg" tooltip={me?.name} />}>
            <MemberAvatar name={me?.name ?? ''} color={me?.color ?? null} size="md" />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-start leading-tight">
              <span className="truncate text-sm font-medium">{me?.name}</span>
              <span className="truncate text-xs text-muted-foreground">{settings.data?.groupName}</span>
            </span>
            <ChevronsUpDownIcon className="ms-auto" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-60">
            <DropdownMenuItem onClick={() => void navigate('/ayarlar')}>
              <UsersIcon />
              {t('members.manage')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => lock(false)}>
              <LogOutIcon />
              {t('members.switch')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
