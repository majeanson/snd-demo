import { useEffect, useState } from 'react'
import { VoiceMemo, type Lang } from './VoiceMemo'

const COPY = {
  fr: {
    eyebrow: 'rev 03 · on extrait',
    nameLine1: 'Truck',
    nameLine2: 'Notes',
    tagline: 'Notes de truck → brouillon de facture le dimanche matin.',
    description:
      'Cette révision : pendant que la note se transcrit, on capte le client, les heures et les matériaux. Prochaine étape — un brouillon de facture rempli tout seul.',
    languageToggle: 'EN',
    footerLeft: 'Sunday Night Dread · démo extraite',
    footerRight: 'rev 03 · parser live',
  },
  en: {
    eyebrow: 'rev 03 · we extract',
    nameLine1: 'Truck',
    nameLine2: 'Notes',
    tagline: 'Truck voice notes → draft invoice by Sunday morning.',
    description:
      'This revision: while the note transcribes, we pull out the client, the hours, and the materials. Next up — an invoice draft that fills itself in.',
    languageToggle: 'FR',
    footerLeft: 'Sunday Night Dread · extracted demo',
    footerRight: 'rev 03 · parser live',
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
