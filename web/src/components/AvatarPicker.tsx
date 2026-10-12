import { useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { FormError } from '@/components/PageShell'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { useAvatarSrc } from '@/lib/avatar'
import { errorMessage } from '@/lib/errors'

// Fotoğraf seç/kaldır. onPick yükleyip kaydı günceller; onRemove görseli kaldırır.
export function AvatarPicker({ path, fallback, onPick, onRemove }: {
  path: string | null
  fallback: ReactNode
  onPick: (file: File) => Promise<void>
  onRemove: () => Promise<void>
}) {
  const { t } = useTranslation()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const src = useAvatarSrc(path)

  async function run(fn: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try { await fn() } catch (e) { setError(e) } finally { setBusy(false) }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <Avatar className="size-16">
          <AvatarImage src={src} alt="" />
          <AvatarFallback>{fallback}</AvatarFallback>
        </Avatar>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => input.current?.click()}>
            {t('profile.changePhoto')}
          </Button>
          {path && (
            <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => void run(onRemove)}>
              {t('profile.removePhoto')}
            </Button>
          )}
        </div>
        <input
          ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) void run(() => onPick(file))
          }}
        />
      </div>
      <FormError message={error ? errorMessage(t, error) : null} />
    </div>
  )
}
