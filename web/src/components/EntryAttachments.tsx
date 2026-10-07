import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { FormError } from '@/components/PageShell'
import { Button } from '@/components/ui/button'
import { callFunction } from '@/lib/api'
import { errorMessage } from '@/lib/errors'
import { supabase } from '@/lib/supabase'

type Att = { id: string; filename: string; storage_key: string }

// Kayda bağlı fiş/fatura ekleri: herkes görür/açar, yalnız kayıt sahibi ekler/siler.
export function EntryAttachments({ entryId, canEdit }: { entryId: string; canEdit: boolean }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const input = useRef<HTMLInputElement>(null)
  const key = ['attachments', entryId]

  const list = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase.from('attachments').select('id, filename, storage_key').eq('entry_id', entryId).order('created_at')
      if (error) throw error
      return data as Att[]
    },
  })

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const a = await callFunction<{ path: string; token: string }>('attachment-create', {
        entry_id: entryId, filename: file.name, mime_type: file.type, size_bytes: file.size,
      })
      const { error } = await supabase.storage.from('attachments').uploadToSignedUrl(a.path, a.token, file)
      if (error) throw error
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: key }),
  })

  const remove = useMutation({
    mutationFn: (id: string) => callFunction('attachment-delete', { attachment_id: id }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: key }),
  })

  async function open(a: Att) {
    const { data, error } = await supabase.storage.from('attachments').createSignedUrl(a.storage_key, 60)
    if (!error && data) window.open(data.signedUrl, '_blank', 'noopener')
  }

  return (
    <div className="flex flex-col gap-1 pb-2 text-sm">
      {list.data?.map((a) => (
        <div key={a.id} className="flex items-center justify-between gap-2">
          <button type="button" className="truncate text-left underline" onClick={() => void open(a)}>{a.filename}</button>
          {canEdit && (
            <Button size="sm" variant="ghost" disabled={remove.isPending} onClick={() => remove.mutate(a.id)}>{t('entry.delete')}</Button>
          )}
        </div>
      ))}
      {list.data?.length === 0 && !canEdit && <p className="text-muted-foreground">{t('attachments.none')}</p>}
      {canEdit && (
        <>
          <input
            ref={input} type="file" hidden accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) upload.mutate(f)
              e.target.value = ''
            }}
          />
          <Button size="sm" variant="outline" className="self-start" disabled={upload.isPending} onClick={() => input.current?.click()}>
            {t('attachments.add')}
          </Button>
        </>
      )}
      <FormError message={upload.error ? errorMessage(t, upload.error) : remove.error ? errorMessage(t, remove.error) : null} />
    </div>
  )
}
