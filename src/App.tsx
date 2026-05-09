import { useEffect, useState } from 'react'

type Lang = 'fr' | 'en'

const COPY = {
  fr: {
    eyebrow: 'révision 01 · barebones',
    nameLine1: 'Truck',
    nameLine2: 'Notes',
    tagline: 'Notes de truck → brouillon de facture le dimanche matin.',
    description:
      'Démo en construction. À chaque révision, une nouvelle pièce du puzzle. Ici, c’est juste le nom — la suite arrive.',
    languageToggle: 'EN',
    footerLeft: 'Sunday Night Dread · démo extraite',
    footerRight: 'révision 01 / 05',
  },
  en: {
    eyebrow: 'rev 01 · barebones',
    nameLine1: 'Truck',
    nameLine2: 'Notes',
    tagline: 'Truck voice notes → draft invoice by Sunday morning.',
    description:
      'Demo under construction. Each revision adds another piece. This one is just the name — the rest is coming.',
    languageToggle: 'FR',
    footerLeft: 'Sunday Night Dread · extracted demo',
    footerRight: 'revision 01 / 05',
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

      <footer className="page-footer mono">
        <span>{t.footerLeft}</span>
        <span>{t.footerRight}</span>
      </footer>
    </main>
  )
}
