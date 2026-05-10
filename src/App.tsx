import { useCallback, useEffect, useState } from 'react'
import { VoiceMemo, type Lang } from './VoiceMemo'
import { InvoiceDraft } from './InvoiceDraft'
import { EMPTY_EXTRACTED, type Extracted } from './parse'

const COPY = {
  fr: {
    eyebrow: 'rev 04 · facture sans douleur',
    nameLine1: 'Truck',
    nameLine2: 'Notes',
    tagline: 'Notes de truck → brouillon de facture le dimanche matin.',
    description:
      'Cette révision : la note se transcrit, le parser extrait les données, et le brouillon de facture se construit en dessous. Taxes du Québec, totaux qui s’ajustent — manque juste à valider et envoyer.',
    languageToggle: 'EN',
    footerLeft: 'Sunday Night Dread · démo extraite',
    footerRight: 'rev 04 · brouillon vivant',
  },
  en: {
    eyebrow: 'rev 04 · invoice without dread',
    nameLine1: 'Truck',
    nameLine2: 'Notes',
    tagline: 'Truck voice notes → draft invoice by Sunday morning.',
    description:
      'This revision: the note transcribes, the parser pulls out the data, and the invoice draft assembles below. Quebec taxes, totals updating live — only thing left is to review and send.',
    languageToggle: 'FR',
    footerLeft: 'Sunday Night Dread · extracted demo',
    footerRight: 'rev 04 · live draft',
  },
} as const

export function App() {
  const [lang, setLang] = useState<Lang>(() => {
    if (typeof navigator === 'undefined') return 'fr'
    return navigator.language.toLowerCase().startsWith('fr') ? 'fr' : 'en'
  })
  const [extracted, setExtracted] = useState<Extracted>(EMPTY_EXTRACTED)
  const t = COPY[lang]

  useEffect(() => {
    document.documentElement.lang = lang === 'fr' ? 'fr-CA' : 'en-CA'
    document.title = `${t.nameLine1} ${t.nameLine2} — ${t.tagline}`
  }, [lang, t])

  // Stable identity so VoiceMemo's effect doesn't fire on every parent render.
  const handleExtracted = useCallback((next: Extracted) => {
    setExtracted(next)
  }, [])

  const hasAny =
    extracted.client !== null || extracted.hours !== null || extracted.materials.length > 0

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

      <VoiceMemo lang={lang} onExtractedChange={handleExtracted} />

      {hasAny && <InvoiceDraft lang={lang} extracted={extracted} />}

      <footer className="page-footer mono">
        <span>{t.footerLeft}</span>
        <span>{t.footerRight}</span>
      </footer>
    </main>
  )
}
