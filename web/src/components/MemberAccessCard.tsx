import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { FormError } from '@/components/PageShell'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { levelOf, useMemberAccess, type AccessLevel } from '@/lib/access'
import { callFunction } from '@/lib/api'
import { errorMessage } from '@/lib/errors'
import { useMembers } from '@/lib/ledger'

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
        {actors.map((who) => (
          <div key={who.id} className="flex flex-col gap-2">
            <p className="font-medium">{who.name}</p>
            {all.filter((o) => o.id !== who.id).map((owner) => (
              <div key={owner.id} className="flex items-center justify-between gap-3">
                <span className="text-sm text-muted-foreground">{t('access.entriesOf', { name: owner.name })}</span>
                <ToggleGroup
                  variant="outline" size="sm" value={[levelOf(access.data ?? [], who.id, owner.id)]}
                  onValueChange={(v) => {
                    const level = v[0] as AccessLevel | undefined
                    if (level) set.mutate({ member_id: who.id, target_member_id: owner.id, level })
                  }}
                >
                  <ToggleGroupItem value="view">{t('access.view')}</ToggleGroupItem>
                  <ToggleGroupItem value="edit">{t('access.edit')}</ToggleGroupItem>
                  <ToggleGroupItem value="delete">{t('access.delete')}</ToggleGroupItem>
                </ToggleGroup>
              </div>
            ))}
          </div>
        ))}
        <FormError message={set.error ? errorMessage(t, set.error) : null} />
      </CardContent>
    </Card>
  )
}
