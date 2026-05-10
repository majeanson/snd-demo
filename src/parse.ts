import type { Lang } from './VoiceMemo'

export interface Extracted {
  client: string | null
  /** Decimal hours (so "deux heures et demie" could one day return 2.5). */
  hours: number | null
  /** Display labels, deduped, in match order. */
  materials: string[]
}

export const EMPTY_EXTRACTED: Extracted = { client: null, hours: null, materials: [] }

const FR_NUM_WORDS: Record<string, number> = {
  une: 1,
  deux: 2,
  trois: 3,
  quatre: 4,
  cinq: 5,
  six: 6,
  sept: 7,
  huit: 8,
  neuf: 9,
  dix: 10,
}

const EN_NUM_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
}

interface MaterialMatcher {
  re: RegExp
  label: string
}

/**
 * Material patterns are intentionally explicit — this is a demo parser, not a
 * NER model. Each entry is a regex anchored to the kind of phrasing a real
 * voice memo would use, paired with the canonical label that ends up on the
 * (Rev 04) invoice line.
 */
const FR_MATERIALS: MaterialMatcher[] = [
  { re: /vis\s+trois\s+et\s+demi/i, label: 'vis 3,5"' },
  { re: /tee\s+pvc/i, label: 'tee PVC' },
  { re: /\b(?:elbow|coude)\b/i, label: 'coude PVC' },
]

const EN_MATERIALS: MaterialMatcher[] = [
  { re: /three-and-a-half-inch\s+screws/i, label: '3.5" screws' },
  { re: /pvc\s+tee/i, label: 'PVC tee' },
  { re: /\belbow\b/i, label: 'PVC elbow' },
]

function parseClient(text: string, lang: Lang): string | null {
  if (lang === 'fr') {
    const m = text.match(/chez\s+([A-ZÀ-ÿ][\wÀ-ÿ'-]+)/)
    return m ? m[1] : null
  }
  // "at Tremblay's" — strip the possessive so the invoice gets a clean name.
  const m = text.match(/at\s+([A-Z][\w-]+)(?:'s)?\b/)
  return m ? m[1] : null
}

function parseHours(text: string, lang: Lang): number | null {
  const re =
    lang === 'fr'
      ? /(\d+(?:[.,]\d+)?|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix)\s+heure/i
      : /(\d+(?:[.,]\d+)?|one|two|three|four|five|six|seven|eight|nine|ten)\s+hours?/i
  const m = text.match(re)
  if (!m) return null
  const raw = m[1].toLowerCase()
  const dict = lang === 'fr' ? FR_NUM_WORDS : EN_NUM_WORDS
  if (dict[raw] != null) return dict[raw]
  const n = Number(raw.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function parseMaterials(text: string, lang: Lang): string[] {
  const matchers = lang === 'fr' ? FR_MATERIALS : EN_MATERIALS
  const found: string[] = []
  for (const m of matchers) {
    if (m.re.test(text) && !found.includes(m.label)) {
      found.push(m.label)
    }
  }
  return found
}

/**
 * Parse the (partial) transcript text into structured fields. Called on every
 * new word, so the caught-panel reveal feels live. Order of detection in the
 * voice script is deliberate: client → hours → materials, so each row of the
 * panel lights up in turn.
 */
export function parseTranscript(text: string, lang: Lang): Extracted {
  if (!text.trim()) return EMPTY_EXTRACTED
  return {
    client: parseClient(text, lang),
    hours: parseHours(text, lang),
    materials: parseMaterials(text, lang),
  }
}
