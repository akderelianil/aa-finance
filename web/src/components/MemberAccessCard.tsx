import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { FormError } from '@/components/PageShell'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { levelOf, useMemberAccess, type AccessLevel } from '@/lib/access'
import { callFunction } from '@/lib/api'
import { errorMessage } from '@/lib/errors'
import { useMembers } from '@/lib/ledger'

const LEVELS: AccessLevel[] = ['view', 'edit', 'delete']

// Admin only: what each member may do with each other member's journal entries. Everyone always views.
export function MemberAccessCard() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const members = useMembers()
  const access = useMemberAccess()
  const set = useMutation({
    mutationFn: (body: { member_id: string; target_member_id: string; level: AccessLevel }) =>
      callFunction('member-access-set', body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ledger', 'member-access'] }),
  })
  const all = members.data ?? []
  // Admins can always change every entry; only members get a setting.
  const actors = all.filter((m) => m.role !== 'admin')
  if (actors.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('access.title')}</CardTitle>
        <CardDescription>{t('access.hint')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('access.member')}</TableHead>
              <TableHead>{t('access.owner')}</TableHead>
              {LEVELS.map((l) => <TableHead key={l} className="w-28 text-center">{t(`access.${l}`)}</TableHead>)}
            </TableRow>
          </TableHeader>
          <TableBody>
            {actors.flatMap((who) =>
              all.filter((o) => o.id !== who.id).map((owner, i) => {
                const level = levelOf(access.data ?? [], who.id, owner.id)
                const rank = LEVELS.indexOf(level)
                const change = (next: AccessLevel) => set.mutate({ member_id: who.id, target_member_id: owner.id, level: next })
                return (
                  <TableRow key={`${who.id}-${owner.id}`}>
                    <TableCell className="font-medium">{i === 0 ? who.name : ''}</TableCell>
                    <TableCell className="text-muted-foreground">{owner.name}</TableCell>
                    {LEVELS.map((l, idx) => (
                      <TableCell key={l} className="text-center">
                        <Checkbox
                          checked={idx <= rank}
                          disabled={idx === 0 || set.isPending}
                          aria-label={`${who.name} · ${owner.name} · ${t(`access.${l}`)}`}
                          // Levels are cumulative: delete implies edit implies view.
                          onCheckedChange={(on) => change(on ? l : LEVELS[idx - 1])}
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                )
              }),
            )}
          </TableBody>
        </Table>
        <FormError message={set.error ? errorMessage(t, set.error) : null} />
      </CardContent>
    </Card>
  )
}
