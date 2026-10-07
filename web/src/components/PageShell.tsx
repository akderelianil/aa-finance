import { createContext, useContext, type ReactNode } from 'react'
import { LanguageSwitcher } from './LanguageSwitcher'

// AppShell içindeki sayfalar kendi çerçevesini AppShell'den alır; PageShell orada sadece içeriği geçirir.
export const InsideAppShell = createContext(false)

// Mobil öncelikli tek sütun kabuk (giriş/onboarding ekranları için).
export function PageShell({ children }: { children: ReactNode }) {
  const inside = useContext(InsideAppShell)
  if (inside) return <div className="flex flex-col gap-4">{children}</div>
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 px-4 py-4">
      <div className="flex justify-end">
        <LanguageSwitcher />
      </div>
      <main className="flex flex-1 flex-col justify-center gap-4 pb-8">{children}</main>
    </div>
  )
}

export function FormError({ message }: { message: string | null }) {
  return message ? <p role="alert" className="text-sm text-destructive">{message}</p> : null
}
