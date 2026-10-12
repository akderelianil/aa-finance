import { colorClass, initials } from '@/lib/members'
import { cn } from '@/lib/utils'

/** A round avatar in the member's profile color with initials. */
export function MemberAvatar({ name, color, size = 'sm', className }: { name: string; color: string | null; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-semibold text-white transition-colors',
        { sm: 'size-6 text-xs', md: 'size-8 text-xs', lg: 'size-10 text-sm' }[size],
        colorClass(color),
        className,
      )}
    >
      {initials(name)}
    </span>
  )
}
