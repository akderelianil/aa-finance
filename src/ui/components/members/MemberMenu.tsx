import { useQueryClient } from '@tanstack/react-query'
import { CheckIcon, ChevronDownIcon, LogOutIcon, UsersIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { setMember, useOp } from '@/lib/api'
import { signOut } from '@/lib/session'
import { MemberAvatar } from './MemberAvatar'

// Breadcrumb root: the member you act as. Picking another member switches at once (no PIN).
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
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t('members.switch')}
        className="inline-flex items-center gap-1.5 rounded-full text-sm text-foreground transition-colors hover:text-foreground/80"
      >
        <MemberAvatar name={me?.name ?? ''} color={me?.color ?? null} size="sm" />
        <span className="max-w-40 truncate font-medium">{me?.name}</span>
        <ChevronDownIcon className="size-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{settings.data?.groupName} · {t('members.switch')}</DropdownMenuLabel>
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
  )
}
