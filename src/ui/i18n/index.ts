import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { en } from './en'
import { tr } from './tr'

export const LANGUAGES = ['tr', 'en'] as const
export type Language = (typeof LANGUAGES)[number]

// Before setup: the system language. After setup: settings.language (App sets it).
const system: Language = navigator.language.toLowerCase().startsWith('tr') ? 'tr' : 'en'

void i18n.use(initReactI18next).init({
  resources: { tr: { translation: tr }, en: { translation: en } },
  lng: system,
  fallbackLng: 'tr',
  interpolation: { escapeValue: false },
})

export default i18n
