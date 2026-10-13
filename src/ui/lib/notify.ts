// The one door for user feedback. Pages never call the toast component directly.
// Policy: success is short, an error stays longer, work in progress is one toast that becomes its result.
// A form that shows its error inline passes `inline: true`, so the same error is not shown twice.
import { toast } from '@/components/ui/toast'

const MS = { success: 3000, info: 4000, warning: 6000, error: 6000 }

type Kind = keyof typeof MS
const show = (type: Kind, title: string, description?: string) => toast.add({ type, title, description, timeout: MS[type] })

export const notify = {
  success: (title: string, description?: string) => show('success', title, description),
  info: (title: string, description?: string) => show('info', title, description),
  warning: (title: string, description?: string) => show('warning', title, description),
  error: (title: string, description?: string) => show('error', title, description),

  /** Work in progress: one toast that shows `pending`, then becomes `done` or the error. */
  async track<T>(
    job: Promise<T>,
    text: { pending: string; done: string | ((out: T) => string | undefined); error: (e: unknown) => string; inline?: boolean },
  ): Promise<T> {
    const id = toast.add({ type: 'loading', title: text.pending, timeout: 0 })
    try {
      const out = await job
      const done = typeof text.done === 'function' ? text.done(out) : text.done
      toast.update(id, { type: 'success', title: done ?? text.pending, description: undefined, timeout: MS.success })
      return out
    } catch (e) {
      if (text.inline) toast.close(id)
      else toast.update(id, { type: 'error', title: text.error(e), description: undefined, timeout: MS.error })
      throw e
    }
  },
}
