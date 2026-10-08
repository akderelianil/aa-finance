import { useQuery } from '@tanstack/react-query'
import { XIcon } from 'lucide-react'
import { useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'

function useGroupTags(groupId: string) {
  return useQuery({
    queryKey: ['tags', groupId],
    queryFn: async () => {
      const { data, error } = await supabase.from('tags').select('id, name').eq('group_id', groupId).order('name')
      if (error) throw error
      return data as { id: string; name: string }[]
    },
  })
}

// Etiket girişi: yaz + Enter (ya da listeden seç) → çip. Grupta daha önce kullanılanlar önerilir.
export function TagsField({ value, onChange, groupId }: { value: string[]; onChange: (v: string[]) => void; groupId: string }) {
  const { t } = useTranslation()
  const tags = useGroupTags(groupId)
  const [draft, setDraft] = useState('')

  function add(raw: string) {
    const s = raw.trim().replace(/^#/, '').trim().slice(0, 40)
    setDraft('')
    if (!s || value.length >= 10 || value.some((v) => v.toLocaleLowerCase() === s.toLocaleLowerCase())) return
    onChange([...value, s])
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if ((e.key === 'Enter' || e.key === ',') && draft.trim()) { e.preventDefault(); add(draft) }
    if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1))
  }

  return (
    <Field>
      <FieldLabel htmlFor="tags">{t('entry.tags.label')}</FieldLabel>
      <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-xl border border-input px-2 py-1 focus-within:ring-3 focus-within:ring-ring/50">
        {value.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-secondary py-0.5 pr-1 pl-2 text-xs text-secondary-foreground">
            #{tag}
            <button type="button" className="rounded-full p-0.5 hover:bg-foreground/10" aria-label={t('entry.tags.remove', { tag })}
              onClick={() => onChange(value.filter((v) => v !== tag))}>
              <XIcon className="size-3" />
            </button>
          </span>
        ))}
        <Input
          id="tags" list="tag-list" autoComplete="off" maxLength={40} placeholder={value.length ? '' : t('entry.tags.placeholder')}
          className="h-7 min-w-24 flex-1 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0 dark:bg-transparent"
          value={draft} onKeyDown={onKeyDown} onBlur={() => add(draft)}
          onChange={(e) => {
            // Listeden seçim: tam ad gelir, hemen çip olur.
            const native = e.nativeEvent as InputEvent
            if (!native.inputType || native.inputType === 'insertReplacementText') add(e.target.value)
            else setDraft(e.target.value)
          }}
        />
        <datalist id="tag-list">
          {tags.data?.filter((x) => !value.includes(x.name)).map((x) => <option key={x.id} value={x.name} />)}
        </datalist>
      </div>
    </Field>
  )
}
