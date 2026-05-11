import { useMemo } from 'react'
import type { Extracted, ParsedSpan } from './parse'
import type { Lang } from './VoiceMemo'
import type { SpeechErrorCode, SpeechRecognitionHandle } from './useSpeechRecognition'

/* ─── Copy ──────────────────────────────────────────────────────────────── */

interface RecipeRow {
  kind: ParsedSpan['kind']
  label: string
  examples: string[]
}

interface VocabSubsection {
  /** Optional sub-label like "vague" or "PVC fittings". */
  sub?: string
  phrases: string[]
}

interface VocabGroup {
  kind: ParsedSpan['kind']
  kindLabel: string
  sections: VocabSubsection[]
}

interface LiveLabels {
  tapToStart: string
  listening: string
  starting: string
  tapToStop: string
  errorByCode: Record<SpeechErrorCode, string>
  tryAgain: string
  recipePrompt: string
  caughtSuffix: (value: string) => string
  recipe: RecipeRow[]
  transcriptPlaceholder: string
  disclosureDemo: string
  vocabSummary: string
  vocabNote: string
  vocab: VocabGroup[]
  disclosureProd: string
  disclosureProdExampleLead: string
  disclosureProdExample: string
  disclosureProdExampleTail: string
  disclosureProdStat: string
  unsupportedBrowsersHint: string
}

const LABELS: Record<Lang, LiveLabels> = {
  fr: {
    tapToStart: 'Toucher pour parler',
    listening: 'À l’écoute…',
    starting: 'Démarrage…',
    tapToStop: 'Toucher pour arrêter',
    errorByCode: {
      unsupported:
        'Ton navigateur ne fait pas la reconnaissance vocale native. Essaie Chrome, Edge ou Safari pour la démo en direct.',
      'not-allowed':
        'Accès au micro refusé. Autorise-le dans les paramètres du navigateur, puis réessaie.',
      'no-mic': 'Aucun micro détecté. Branches-en un et réessaie.',
      network:
        'Impossible de joindre le service de transcription. Vérifie ta connexion réseau.',
      unknown: 'Quelque chose a coincé. Réessaie.',
    },
    tryAgain: 'Réessayer',
    recipePrompt: 'Dis une chose de chaque pour remplir la facture',
    caughtSuffix: (value) => `capté « ${value} »`,
    recipe: [
      {
        kind: 'client',
        label: 'Client',
        examples: ['chez Tremblay', 'pour Tremblay', 'chantier Tremblay'],
      },
      {
        kind: 'hours',
        label: 'Heures',
        examples: [
          'deux heures',
          'deux heures et demie',
          'toute la matinée',
          '1h30',
        ],
      },
      {
        kind: 'material',
        label: 'Matériaux',
        examples: [
          'tee PVC',
          'coude PVC',
          'vis trois et demi',
          'colle PVC',
          'ruban Téflon',
        ],
      },
    ],
    transcriptPlaceholder:
      'Ce que tu dis apparaîtra ici. Les phrases captées par le parser seront surlignées au fur et à mesure.',
    disclosureDemo:
      'Reconnaissance vocale native du navigateur (gratuite) + parser regex (déterministe). Tu vois exactement ce qui est reconnu — c’est pour pouvoir tester équitablement la démo.',
    vocabSummary: 'Tout ce que la démo reconnaît',
    vocabNote:
      'Cette liste est le vocabulaire de la démo. En production (voir ci-dessous), il n’y a pas de liste — n’importe quelle formulation marche.',
    vocab: [
      {
        kind: 'client',
        kindLabel: 'Client',
        sections: [
          {
            phrases: [
              'chez NOM',
              'pour NOM',
              'chantier NOM',
              'job NOM',
              'place NOM',
              'facturer NOM',
            ],
          },
        ],
      },
      {
        kind: 'hours',
        kindLabel: 'Heures',
        sections: [
          { sub: 'nombres', phrases: ['deux heures', '2,5 heures', 'deux heures et demie'] },
          { sub: 'notation', phrases: ['1h30', '2h45'] },
          { sub: 'fractions', phrases: ['demi-heure', 'quart d’heure', 'une heure'] },
          {
            sub: 'vague',
            phrases: [
              'une couple d’heures',
              'quelques heures',
              'demi-journée',
              'une journée',
              'toute la matinée',
              'tout l’après-midi',
            ],
          },
        ],
      },
      {
        kind: 'material',
        kindLabel: 'Matériaux',
        sections: [
          {
            sub: 'raccords PVC',
            phrases: ['tee PVC', 'coude PVC', 'manchon PVC', 'valve PVC (à bille)'],
          },
          {
            sub: 'consommables',
            phrases: ['colle PVC', 'ruban Téflon', 'silicone'],
          },
          {
            sub: 'attaches',
            phrases: ['vis 2"', 'vis 3,5"', 'vis 4"'],
          },
        ],
      },
    ],
    disclosureProd:
      'En production, Claude (ou un autre LLM) est branché sur la transcription. Aucun vocabulaire figé — n’importe quelle phrase fonctionne, incluant les idiomes québécois (« asteure », « pis », « j’me ramasse »).',
    disclosureProdExampleLead: 'Exemple typique :',
    disclosureProdExample:
      'Tantôt chez Tremblay, j’ai changé un raccord pis scellé ça avec un peu de colle, ça m’a pris une couple d’heures.',
    disclosureProdExampleTail:
      'Tout est extrait — client, heures, matériaux — sans avoir à formuler comme un robot.',
    disclosureProdStat:
      '≈ 2× le taux de capture sur de la parole naturelle (~90 % vs ~40 % pour le regex).',
    unsupportedBrowsersHint:
      'Pris en charge : Chrome, Edge, Safari. Pas Firefox ni la majorité des navigateurs intégrés aux apps.',
  },
  en: {
    tapToStart: 'Tap to talk',
    listening: 'Listening…',
    starting: 'Starting…',
    tapToStop: 'Tap to stop',
    errorByCode: {
      unsupported:
        "Your browser doesn't expose native speech recognition. Try Chrome, Edge, or Safari for the live demo.",
      'not-allowed':
        'Microphone access denied. Allow it in your browser settings, then try again.',
      'no-mic': 'No microphone detected. Plug one in and try again.',
      network:
        "Couldn't reach the speech service. Check your network and try again.",
      unknown: 'Something went wrong. Try again.',
    },
    tryAgain: 'Try again',
    recipePrompt: 'Say one of each to fill the invoice',
    caughtSuffix: (value) => `caught "${value}"`,
    recipe: [
      {
        kind: 'client',
        label: 'Client',
        examples: ['at Tremblay', 'for Smith', 'Smith job', 'billing Tremblay'],
      },
      {
        kind: 'hours',
        label: 'Hours',
        examples: [
          'two hours',
          'two and a half hours',
          'couple hours',
          'half day',
          'all morning',
        ],
      },
      {
        kind: 'material',
        label: 'Materials',
        examples: [
          'PVC tee',
          'PVC elbow',
          'PVC coupling',
          'three-and-a-half-inch screws',
          'PVC cement',
          'Teflon tape',
        ],
      },
    ],
    transcriptPlaceholder:
      "What you say will appear here. Phrases the parser catches will get highlighted as you speak.",
    disclosureDemo:
      'Browser-native speech recognition (free) + regex parser (deterministic). You see exactly what is recognized — so you can test the demo fairly.',
    vocabSummary: 'Everything the demo recognizes',
    vocabNote:
      "This list is the demo's vocabulary. In production (see below), there is no list — any phrasing works.",
    vocab: [
      {
        kind: 'client',
        kindLabel: 'Client',
        sections: [
          {
            phrases: [
              'at NAME',
              'for NAME',
              "NAME's place",
              "NAME's job",
              "NAME's property",
              'billing NAME',
            ],
          },
        ],
      },
      {
        kind: 'hours',
        kindLabel: 'Hours',
        sections: [
          { sub: 'numbers', phrases: ['two hours', '2.5 hours', 'two and a half hours'] },
          { sub: 'notation', phrases: ['1h30', '2h45'] },
          { sub: 'fractions', phrases: ['half an hour', 'quarter hour', 'an hour'] },
          {
            sub: 'vague',
            phrases: [
              'couple hours',
              'few hours',
              'half day',
              'full day',
              'all morning',
              'all afternoon',
            ],
          },
        ],
      },
      {
        kind: 'material',
        kindLabel: 'Materials',
        sections: [
          {
            sub: 'PVC fittings',
            phrases: ['PVC tee', 'PVC elbow', 'PVC coupling', 'PVC ball valve'],
          },
          {
            sub: 'consumables',
            phrases: ['PVC cement', 'Teflon tape', 'silicone (sealant)'],
          },
          {
            sub: 'fasteners',
            phrases: ['2" screws', '3.5" screws', '4" screws'],
          },
        ],
      },
    ],
    disclosureProd:
      'Production routes the transcript through Claude (or another LLM). No fixed vocabulary — any phrasing works, including Quebec idioms ("asteure", "pis", "j’me ramasse") and rambling memos.',
    disclosureProdExampleLead: 'Typical example:',
    disclosureProdExample:
      "Spent the afternoon at Tremblay's, ran a new T-fitting and sealed it up with some plumber's glue — call it a couple hours.",
    disclosureProdExampleTail:
      'All extracted — client, hours, materials — without phrasing it like a robot.',
    disclosureProdStat:
      '≈ 2× the catch rate on natural speech (~90% vs ~40% for regex).',
    unsupportedBrowsersHint:
      'Supported: Chrome, Edge, Safari. Not Firefox or most in-app browsers.',
  },
}

/* ─── Component ─────────────────────────────────────────────────────────── */

interface Props {
  speech: SpeechRecognitionHandle
  lang: Lang
  /** Latest parse of the live transcript — drives recipe states + highlights. */
  extracted: Extracted
}

export function LiveRecorder({ speech, lang, extracted }: Props) {
  const t = LABELS[lang]
  const listening = speech.state === 'listening' || speech.state === 'starting'
  const hasError = speech.state === 'error'
  // Unsupported gets its own non-interactive state — tapping does nothing
  // useful (no SR ctor) so the error block explains and the mic is muted.
  const unsupported = !speech.supported || speech.errorCode === 'unsupported'

  const caught = {
    client: extracted.client,
    hours: extracted.hours,
    materials: extracted.materials,
  }

  const onMic = () => {
    if (unsupported) return
    if (hasError) {
      speech.reset()
      speech.start()
      return
    }
    if (listening) {
      speech.stop()
    } else {
      speech.start()
    }
  }

  const statusLabel =
    speech.state === 'listening'
      ? t.listening
      : speech.state === 'starting'
        ? t.starting
        : t.tapToStart

  const errorMessage = hasError && speech.errorCode ? t.errorByCode[speech.errorCode] : null

  return (
    <div className="live">
      <div className="live__mic-row">
        <button
          type="button"
          className={[
            'live__mic',
            listening ? 'live__mic--on' : '',
            hasError ? 'live__mic--error' : '',
            unsupported ? 'live__mic--disabled' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          onClick={onMic}
          aria-pressed={listening}
          aria-label={listening ? t.tapToStop : t.tapToStart}
          aria-disabled={unsupported}
        >
          <span className="live__mic-rings" aria-hidden="true">
            <span className="live__mic-ring" />
            <span className="live__mic-ring" />
          </span>
          <span className="live__mic-icon" aria-hidden="true">
            <MicIcon />
          </span>
        </button>
        <div className="live__status">
          <span className="live__status-label">{statusLabel}</span>
        </div>
      </div>

      {hasError && errorMessage && (
        <div className="live__error" role="alert">
          <p className="live__error-msg">{errorMessage}</p>
          {speech.errorCode === 'unsupported' && (
            <p className="live__error-hint mono">{t.unsupportedBrowsersHint}</p>
          )}
          {speech.errorCode !== 'unsupported' && (
            <button
              type="button"
              className="live__retry"
              onClick={() => {
                speech.reset()
                speech.start()
              }}
            >
              {t.tryAgain}
            </button>
          )}
        </div>
      )}

      <RecipeCard rows={t.recipe} caught={caught} prompt={t.recipePrompt} caughtSuffix={t.caughtSuffix} />

      <div className="live__transcript" aria-live="polite" aria-atomic="false">
        {speech.finalText || speech.interim ? (
          <>
            {speech.finalText && (
              <HighlightedText text={speech.finalText} spans={extracted.spans} />
            )}
            {speech.interim && (
              <span className="live__interim">
                {speech.finalText ? ' ' : ''}
                {speech.interim}
              </span>
            )}
          </>
        ) : (
          <span className="live__placeholder">{t.transcriptPlaceholder}</span>
        )}
      </div>

      <aside className="live__disclosure" aria-label="how this works">
        <div className="live__disclosure-line">
          <span className="live__disclosure-tag mono">demo</span>
          <div className="live__disclosure-body">
            <p className="live__disclosure-text">{t.disclosureDemo}</p>
            <details className="vocab">
              <summary className="vocab__summary">{t.vocabSummary}</summary>
              <div className="vocab__body">
                {t.vocab.map((group) => (
                  <div key={group.kind} className={`vocab__group vocab__group--${group.kind}`}>
                    <p className="vocab__kind-label mono">{group.kindLabel}</p>
                    <div className="vocab__sections">
                      {group.sections.map((sec, i) => (
                        <div key={i} className="vocab__section">
                          {sec.sub && <span className="vocab__sub mono">{sec.sub}</span>}
                          <div className="vocab__phrases">
                            {sec.phrases.map((p) => (
                              <span key={p} className="vocab__phrase">
                                {p}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                <p className="vocab__note">{t.vocabNote}</p>
              </div>
            </details>
          </div>
        </div>

        <div className="live__disclosure-line live__disclosure-line--prod">
          <span className="live__disclosure-tag live__disclosure-tag--prod mono">prod</span>
          <div className="live__disclosure-body">
            <p className="live__disclosure-text">{t.disclosureProd}</p>
            <figure className="prod-example">
              <span className="prod-example__lead mono">{t.disclosureProdExampleLead}</span>
              <blockquote className="prod-example__quote">
                <span aria-hidden="true">“</span>
                {t.disclosureProdExample}
                <span aria-hidden="true">”</span>
              </blockquote>
              <figcaption className="prod-example__tail">{t.disclosureProdExampleTail}</figcaption>
            </figure>
            <p className="live__disclosure-stat">{t.disclosureProdStat}</p>
          </div>
        </div>
      </aside>
    </div>
  )
}

/* ─── Sub-components ────────────────────────────────────────────────────── */

interface RecipeCardProps {
  rows: RecipeRow[]
  caught: { client: string | null; hours: number | null; materials: string[] }
  prompt: string
  caughtSuffix: (value: string) => string
}

function RecipeCard({ rows, caught, prompt, caughtSuffix }: RecipeCardProps) {
  return (
    <div className="recipe" aria-label={prompt}>
      <p className="recipe__head mono">{prompt}</p>
      <ul className="recipe__rows">
        {rows.map((row) => {
          const caughtValue = caughtValueFor(row.kind, caught)
          const isCaught = caughtValue !== null
          return (
            <li
              key={row.kind}
              className={`recipe__row recipe__row--${row.kind}${isCaught ? ' recipe__row--caught' : ''}`}
            >
              <span className="recipe__status" aria-hidden="true">
                {isCaught ? '✓' : '○'}
              </span>
              <span className="recipe__label mono">{row.label}</span>
              {isCaught ? (
                <span className="recipe__caught">{caughtSuffix(caughtValue!)}</span>
              ) : (
                <span className="recipe__examples">
                  {row.examples.map((ex, i) => (
                    <span key={i} className="recipe__example">
                      {ex}
                    </span>
                  ))}
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function caughtValueFor(
  kind: ParsedSpan['kind'],
  caught: { client: string | null; hours: number | null; materials: string[] },
): string | null {
  if (kind === 'client') return caught.client
  if (kind === 'hours') return caught.hours !== null ? `${caught.hours} h` : null
  // Materials may have several matches — join the labels comma-separated.
  return caught.materials.length > 0 ? caught.materials.join(', ') : null
}

interface HighlightedTextProps {
  text: string
  spans: ParsedSpan[]
}

/**
 * Render `text` with `<mark>` wrappers around each `spans[i]` slice.
 * Spans are pre-sorted by `parseTranscript`; we walk left-to-right and skip
 * any overlapping span (rare; would mean two patterns matched the same range).
 */
function HighlightedText({ text, spans }: HighlightedTextProps) {
  const nodes = useMemo(() => {
    if (spans.length === 0) return [<span key="all" className="live__final">{text}</span>]
    const out: React.ReactNode[] = []
    let cursor = 0
    spans.forEach((span, i) => {
      if (span.start < cursor) return // overlap — skip
      if (span.start > cursor) {
        out.push(
          <span key={`pre-${i}`} className="live__final">
            {text.slice(cursor, span.start)}
          </span>,
        )
      }
      out.push(
        <mark
          key={`mark-${i}`}
          className={`live__mark live__mark--${span.kind}`}
          title={span.value}
        >
          {text.slice(span.start, span.end)}
        </mark>,
      )
      cursor = span.end
    })
    if (cursor < text.length) {
      out.push(
        <span key="tail" className="live__final">
          {text.slice(cursor)}
        </span>,
      )
    }
    return out
  }, [text, spans])
  return <>{nodes}</>
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" />
      <path
        d="M5 11a7 7 0 0 0 14 0"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <line
        x1="12"
        y1="18"
        x2="12"
        y2="22"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <line
        x1="8"
        y1="22"
        x2="16"
        y2="22"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}
