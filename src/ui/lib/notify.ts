// User feedback for work in progress: one toast per write that goes running → done or failed.
import { toast } from '@/components/ui/toast'

type Text = { pending: string; done: string; error: (e: unknown) => string }

export function track<T>(job: Promise<T>, text: Text): Promise<T> {
  return toast.promise(job, {
    loading: { title: text.pending },
    success: { title: text.done, timeout: 3000 },
    error: (e: unknown) => ({ title: text.error(e), timeout: 6000 }),
  })
}
