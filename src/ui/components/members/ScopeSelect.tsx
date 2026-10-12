import { useTranslation } from 'react-i18next'
import { OptionSelect } from '@/components/OptionSelect'
import { useOp } from '@/lib/api'
import { setScope, useScope, type Scope } from '@/lib/scope'

/** Aile / one member / Ortak. The pages Reports, Yevmiye and Hesap Planı share the choice. */
export function ScopeSelect() {
  const { t } = useTranslation()
  const members = useOp('members.list', {}).data
  const { scope } = useScope(members?.map((m) => m.id))
  return (
    <OptionSelect
      className="w-44" label={t('scope.label')} value={scope} onChange={(v) => setScope(v as Scope)}
      options={[
        { value: 'family', label: t('scope.family') },
        ...(members ?? []).map((m) => ({ value: String(m.id), label: m.name })),
        { value: 'shared', label: t('scope.shared') },
      ]}
    />
  )
}
