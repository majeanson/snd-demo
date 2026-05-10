import { useEffect, useState } from 'react'
import { VoiceMemo, type Lang } from './VoiceMemo'

const COPY = {
  fr: {
    eyebrow: 'rev 02 · note vocale',
    nameLine1: 'Truck',
    nameLine2: 'Notes',
    tagline: 'Notes de truck → brouillon de facture le dimanche matin.',
    description:
      'Cette révision : on entend la note prise dans le truck, et le transcript se révèle à mesure. Prochaine étape — on va chercher les heures et les matériaux dedans.',
    languageToggle: 'EN',
    footerLeft: 'Sunday Night Dread · démo extraite',
    footerRight: 'rev 02 · transcript live',
  },
  en: {
    eyebrow: 'rev 02 · voice note',
    nameLine1: 'Truck',
    nameLine2: 'Notes',
    tagline: 'Truck voice notes → draft invoice by Sunday morning.',
    description:
      'This revision: hear the note taken in the truck, watch the transcript reveal itself. Next up — we pull hours and materials out of it.',
    languageToggle: 'FR',
    footerLeft: 'Sunday Night Dread · extracted demo',
    footerRight: 'rev 02 · transcript live',
  },
} as const

export function App() {
  const [lang, setLang] = useState<Lang>(() => {
    if (typeof navigator === 'undefined') return 'fr'
    return navigator.language.toLowerCase().startsWith('fr') ? 'fr' : 'en'
  })
  const t = COPY[lang]

  useEffect(() => {
    document.documentElement.lang = lang === 'fr' ? 'fr-CA' : 'en-CA'
    document.title = `${t.nameLine1} ${t.nameLine2} — ${t.tagline}`
  }, [lang, t])

  return (
    <main className="page">
      <button
        type="button"
        className="lang-toggle mono"
        onClick={() => setLang((l) => (l === 'fr' ? 'en' : 'fr'))}
        aria-label={t.languageToggle}
      >
        {t.languageToggle}
      </button>

      <section className="hero">
        <p className="hero__eyebrow mono">{t.eyebrow}</p>
        <h1 className="hero__name">
          <span className="hero__name-line">{t.nameLine1}</span>
          <span className="hero__name-line hero__name-line--accent">{t.nameLine2}</span>
        </h1>
        <p className="hero__tagline">{t.tagline}</p>
        <p className="hero__description">{t.description}</p>
      </section>

      <VoiceMemo lang={lang} />

      <footer className="page-footer mono">
        <span>{t.footerLeft}</span>
        <span>{t.footerRight}</span>
      </footer>
    </main>
  )
}
