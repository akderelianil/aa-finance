// Inline SVG flags (emoji flags do not render on Windows).
export function Flag({ lng }: { lng: 'tr' | 'en' }) {
  return lng === 'tr' ? (
    <svg viewBox="0 0 30 20" className="h-3.5 w-5 shrink-0 rounded-[2px]" aria-hidden>
      <rect width="30" height="20" fill="#E30A17" />
      <circle cx="11" cy="10" r="5" fill="#fff" />
      <circle cx="12.5" cy="10" r="4" fill="#E30A17" />
      <path d="m17.5 10 4.4-1.5-2.7 3.7v-4.4l2.7 3.7z" fill="#fff" />
    </svg>
  ) : (
    <svg viewBox="0 0 60 40" className="h-3.5 w-5 shrink-0 rounded-[2px]" aria-hidden>
      <rect width="60" height="40" fill="#012169" />
      <path d="m0 0 60 40M60 0 0 40" stroke="#fff" strokeWidth="8" />
      <path d="m0 0 60 40M60 0 0 40" stroke="#C8102E" strokeWidth="3" />
      <path d="M30 0v40M0 20h60" stroke="#fff" strokeWidth="12" />
      <path d="M30 0v40M0 20h60" stroke="#C8102E" strokeWidth="7" />
    </svg>
  )
}
