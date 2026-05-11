import { useCallback, useEffect, useState } from 'react'
import { VoiceMemo, type Lang } from './VoiceMemo'
import { InvoiceDraft } from './InvoiceDraft'
import { Topbar } from './Topbar'
import { LoginModal } from './LoginModal'
import { EMPTY_EXTRACTED, type Extracted } from './parse'

const COPY = {
  fr: {
    eyebrow: 'rev 05 · prêt à expédier',
    nameLine1: 'Truck',
    nameLine2: 'Notes',
    tagline: 'Notes de truck → brouillon de facture le dimanche matin.',
    description:
      'Révision finale : note vocale — échantillon scripté ou ta propre voix au micro — qui alimente un parser, qui remplit le brouillon de facture en direct. Connexion client, métrique, envoi/impression, tout prêt à intégrer dans un vrai produit.',
    metricAssembling: 'Construction du brouillon en cours…',
    metricReady: (sec: string) => `Note → facture · prête en ${sec} s`,
    metricSaved: '≈ 45 min de moins qu’une saisie le dimanche soir',
    footerLeft: 'Sunday Night Dread · démo extraite',
    footerRight: 'rev 05 · prêt à expédier',
  },
  en: {
    eyebrow: 'rev 05 · ship-ready',
    nameLine1: 'Truck',
    nameLine2: 'Notes',
    tagline: 'Truck voice notes → draft invoice by Sunday morning.',
    description:
      'Final revision: voice memo — scripted sample or your own voice via mic — feeds a parser that builds the invoice draft live. Sign-in, timing metric, send/print, all polished and ready to drop into a real product.',
    metricAssembling: 'Assembling the draft…',
    metricReady: (sec: string) => `Note → invoice · ready in ${sec} s`,
    metricSaved: '≈ 45 min less than typing it Sunday night',
    footerLeft: 'Sunday Night Dread · extracted demo',
    footerRight: 'rev 05 · ship-ready',
  },
} as const

export function App() {
  const [lang, setLang] = useState<Lang>(() => {
    if (typeof navigator === 'undefined') return 'fr'
    return navigator.language.toLowerCase().startsWith('fr') ? 'fr' : 'en'
  })
  const [extracted, setExtracted] = useState<Extracted>(EMPTY_EXTRACTED)
  const [loginOpen, setLoginOpen] = useState(false)

  // Stopwatch from the parser's first hit to the moment the invoice is fully
  // assembled (client + hours + ≥1 material). Both reset to null when the
  // user replays from zero, so the metric naturally restarts each playthrough.
  const [firstDetectionAt, setFirstDetectionAt] = useState<number | null>(null)
  const [completionAt, setCompletionAt] = useState<number | null>(null)

  const t = COPY[lang]

  useEffect(() => {
    document.documentElement.lang = lang === 'fr' ? 'fr-CA' : 'en-CA'
    document.title = `${t.nameLine1} ${t.nameLine2} — ${t.tagline}`
  }, [lang, t])

  const handleExtracted = useCallback((next: Extracted) => {
    setExtracted(next)
    const hasAny =
      next.client !== null || next.hours !== null || next.materials.length > 0
    const isComplete =
      next.client !== null && next.hours !== null && next.materials.length >= 1
    // Functional updaters keep deps empty — callback identity stays stable so
    // VoiceMemo's effect doesn't re-fire on every parent render.
    setFirstDetectionAt((prev) => {
      if (!hasAny) return null
      if (prev === null) return performance.now()
      return prev
    })
    setCompletionAt((prev) => {
      if (!hasAny) return null
      if (isComplete && prev === null) return performance.now()
      if (!isComplete) return null
      return prev
    })
  }, [])

  const hasAny =
    extracted.client !== null || extracted.hours !== null || extracted.materials.length > 0

  return (
    <main className="page">
      <Topbar
        lang={lang}
        onLangSwitch={() => setLang((l) => (l === 'fr' ? 'en' : 'fr'))}
        onLoginClick={() => setLoginOpen(true)}
      />

      <section id="main" className="hero">
        <p className="hero__eyebrow mono">{t.eyebrow}</p>
        <h1 className="hero__name">
          <span className="hero__name-line">{t.nameLine1}</span>
          <span className="hero__name-line hero__name-line--accent">{t.nameLine2}</span>
        </h1>
        <p className="hero__tagline">{t.tagline}</p>
        <p className="hero__description">{t.description}</p>
      </section>

      <VoiceMemo lang={lang} onExtractedChange={handleExtracted} />

      {hasAny && (
        <>
          <Metric
            firstDetectionAt={firstDetectionAt}
            completionAt={completionAt}
            assemblingLabel={t.metricAssembling}
            readyLabel={t.metricReady}
            savedLabel={t.metricSaved}
            lang={lang}
          />
          <InvoiceDraft lang={lang} extracted={extracted} />
        </>
      )}

      <footer className="page-footer mono">
        <span>{t.footerLeft}</span>
        <span>{t.footerRight}</span>
      </footer>

      {loginOpen && <LoginModal lang={lang} onClose={() => setLoginOpen(false)} />}
    </main>
  )
}

/**
 * Time-to-invoice chip. Renders nothing while the parser hasn't seen anything;
 * shows "Assembling…" while incomplete; flips to a pinned "Ready in X s"
 * value once the invoice has its essentials. Both states use only stable
 * state, so render stays pure (no `performance.now()` in JSX).
 */
function Metric({
  firstDetectionAt,
  completionAt,
  assemblingLabel,
  readyLabel,
  savedLabel,
  lang,
}: {
  firstDetectionAt: number | null
  completionAt: number | null
  assemblingLabel: string
  readyLabel: (sec: string) => string
  savedLabel: string
  lang: Lang
}) {
  if (firstDetectionAt === null) return null

  if (completionAt === null) {
    return (
      <div className="metric-wrap">
        <div className="metric metric--pending" role="status" aria-live="polite">
          <span className="metric__dot" aria-hidden="true" />
          <span>{assemblingLabel}</span>
        </div>
      </div>
    )
  }

  const sec = ((completionAt - firstDetectionAt) / 1000).toFixed(1)
  const formatted = lang === 'fr' ? sec.replace('.', ',') : sec
  return (
    <div className="metric-wrap">
      <div className="metric metric--ready" role="status" aria-live="polite">
        <span className="metric__check" aria-hidden="true">
          ✓
        </span>
        <span>{readyLabel(formatted)}</span>
      </div>
      <p className="metric__saved">{savedLabel}</p>
    </div>
  )
}
