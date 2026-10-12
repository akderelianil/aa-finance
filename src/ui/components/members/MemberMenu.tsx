import { useQueryClient } from '@tanstack/react-query'
import { CheckIcon, ChevronsUpDownIcon, LogOutIcon, UsersIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar'
import { setMember, useOp } from '@/lib/api'
import { signOut } from '@/lib/session'
import { MemberAvatar } from './MemberAvatar'

// Sidebar header: the group and the member you act as. Picking another member switches at once (no PIN).
export function MemberMenu() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const settings = useOp('settings.get', {})
  const members = useOp('members.list', {})
  const me = members.data?.find((m) => m.me)

  function pick(id: number) {
    setMember(id)
    void qc.invalidateQueries()
  }

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
            <DropdownMenuGroup>
              <DropdownMenuLabel>{t('members.switch')}</DropdownMenuLabel>
              {members.data?.map((m) => (
                <DropdownMenuItem key={m.id} onClick={() => !m.me && pick(m.id)}>
                  <MemberAvatar name={m.name} color={m.color} />
                  <span className="min-w-0 flex-1 truncate">{m.name}</span>
                  <span className="text-xs text-muted-foreground">{t(`role.${m.role}`)}</span>
                  <CheckIcon className={m.me ? undefined : 'invisible'} />
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => void navigate('/ayarlar')}>
              <UsersIcon />
              {t('members.manage')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={signOut}>
              <LogOutIcon />
              {t('members.signOut')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
