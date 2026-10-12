import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { initials, useAvatarSrc } from '@/lib/avatar'
import type { NavUserInfo } from './NavUser'

const SECTIONS: Record<string, string> = {
  hesaplar: 'accounts',
  yevmiye: 'journal',
  raporlar: 'reports',
  rehber: 'directory',
  ayarlar: 'settings',
}

// Header trail: user (avatar + name) > Home > current section.
export function AppBreadcrumb({ user }: { user: NavUserInfo }) {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const src = useAvatarSrc(user.avatarPath)
  const key = SECTIONS[pathname.split('/')[1] ?? '']
  const trail = [
    { to: '/anasayfa', label: t('nav.home'), current: !key },
    ...(key ? [{ to: `/${pathname.split('/')[1]}`, label: t(`nav.${key}`), current: true }] : []),
  ]

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem className="gap-2">
          <Avatar size="sm">
            <AvatarImage src={src} alt={user.name} />
            <AvatarFallback>{initials(user.name)}</AvatarFallback>
          </Avatar>
          <span className="font-medium text-foreground">{user.name}</span>
        </BreadcrumbItem>
        {trail.map((item) => (
          <Fragment key={item.to}>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              {item.current ? (
                <BreadcrumbPage>{item.label}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink render={<Link to={item.to} />}>{item.label}</BreadcrumbLink>
              )}
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
