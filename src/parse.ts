import type { Lang } from './VoiceMemo'

/**
 * A single recognized phrase in the source text. Used by the live transcript
 * to highlight what the parser caught (and by extension, what it *didn't*).
 */
export interface ParsedSpan {
  start: number
  end: number
  kind: 'client' | 'hours' | 'material'
  /** Normalized display value (e.g. "Tremblay", "2.5h", "PVC tee"). */
  value: string
}

export interface Extracted {
  client: string | null
  /** Decimal hours (so "deux heures et demie" returns 2.5). */
  hours: number | null
  /** Display labels, deduped, in match order. */
  materials: string[]
  /** Span index for live-transcript highlighting; safe to ignore otherwise. */
  spans: ParsedSpan[]
}

export const EMPTY_EXTRACTED: Extracted = {
  client: null,
  hours: null,
  materials: [],
  spans: [],
}

/* ─── Number-word dictionaries ─────────────────────────────────────────── */

const FR_NUM_WORDS: Record<string, number> = {
  une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5,
  six: 6, sept: 7, huit: 8, neuf: 9, dix: 10,
}

const EN_NUM_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
}

/* ─── Material vocabulary ──────────────────────────────────────────────── */

interface MaterialMatcher {
  re: RegExp
  label: string
}

/**
 * Display labels for the caught panel. Stable lookup keys live in
 * `InvoiceDraft.tsx`'s MATERIAL_BOOK; this map gives the cleaner short
 * version that the panel + recipe card render.
 */
export const MATERIAL_DISPLAY: Record<Lang, Record<string, string>> = {
  fr: {
    'vis 3,5"': 'Vis 3,5"',
    'vis 2"': 'Vis 2"',
    'vis 4"': 'Vis 4"',
    'tee PVC': 'Tee PVC ¾"',
    'coude PVC': 'Coude PVC ¾"',
    'manchon PVC': 'Manchon PVC ¾"',
    'valve PVC': 'Valve PVC à bille',
    'colle PVC': 'Colle PVC',
    'ruban Téflon': 'Ruban Téflon',
    'silicone': 'Scellant silicone',
  },
  en: {
    '3.5" screws': '3.5" screws',
    '2" screws': '2" screws',
    '4" screws': '4" screws',
    'PVC tee': 'PVC tee ¾"',
    'PVC elbow': 'PVC elbow ¾"',
    'PVC coupling': 'PVC coupling ¾"',
    'PVC ball valve': 'PVC ball valve',
    'PVC cement': 'PVC cement',
    'Teflon tape': 'Teflon tape',
    'Silicone sealant': 'Silicone sealant',
  },
}

// Patterns use the `d` flag so each match exposes capture-group indices —
// needed for highlighting in the live transcript. Highlighting targets the
// whole match m[0]; client uses capture group 1 to highlight just the name.
const FR_MATERIALS: MaterialMatcher[] = [
  { re: /\bvis\s+(?:de\s+)?(?:trois\s+et\s+demi|3[.,]5)/id, label: 'vis 3,5"' },
  { re: /\bvis\s+(?:de\s+)?(?:deux|2)\s*(?:po|pouces?|")?/id, label: 'vis 2"' },
  { re: /\bvis\s+(?:de\s+)?(?:quatre|4)\s*(?:po|pouces?|")?/id, label: 'vis 4"' },
  { re: /\btee\s+(?:en\s+)?(?:pvc|p\.?\s?v\.?\s?c\.?)\b/id, label: 'tee PVC' },
  { re: /\b(?:coude|elbow)(?:\s+(?:en\s+)?(?:pvc|p\.?\s?v\.?\s?c\.?))?\b/id, label: 'coude PVC' },
  { re: /\bmanchon\s+(?:en\s+)?(?:pvc|p\.?\s?v\.?\s?c\.?)\b/id, label: 'manchon PVC' },
  { re: /\bvalve\s+(?:à\s+bille\s+)?(?:en\s+)?(?:pvc|p\.?\s?v\.?\s?c\.?)\b/id, label: 'valve PVC' },
  { re: /\b(?:colle|ciment)\s+(?:à\s+)?(?:pvc|p\.?\s?v\.?\s?c\.?)\b/id, label: 'colle PVC' },
  { re: /\b(?:ruban\s+)?(?:téflon|teflon)(?:\s+tape)?\b/id, label: 'ruban Téflon' },
  { re: /\bsilicone(?:\s+(?:scellant|d['' ]?étanchéité))?\b/id, label: 'silicone' },
]

const EN_MATERIALS: MaterialMatcher[] = [
  {
    re: /\b(?:three[\s-]?and[\s-]?a[\s-]?half[\s-]?inch|3[.,]5\s*(?:inch|in|"))\s+screws?\b/id,
    label: '3.5" screws',
  },
  {
    re: /\b(?:two[\s-]?inch|2\s*(?:inch|in|"))\s+screws?\b/id,
    label: '2" screws',
  },
  {
    re: /\b(?:four[\s-]?inch|4\s*(?:inch|in|"))\s+screws?\b/id,
    label: '4" screws',
  },
  { re: /\b(?:pvc|p\.?\s?v\.?\s?c\.?)\s+tee\b/id, label: 'PVC tee' },
  { re: /\b(?:pvc\s+|p\.?\s?v\.?\s?c\.?\s+)?elbow\b/id, label: 'PVC elbow' },
  { re: /\b(?:pvc|p\.?\s?v\.?\s?c\.?)\s+coupling\b/id, label: 'PVC coupling' },
  {
    re: /\b(?:pvc|p\.?\s?v\.?\s?c\.?)\s+(?:ball\s+)?valve\b/id,
    label: 'PVC ball valve',
  },
  {
    re: /\b(?:pvc\s+)?(?:cement|primer|glue)\b/id,
    label: 'PVC cement',
  },
  {
    re: /\b(?:teflon|ptfe|plumber'?s?)\s+tape\b/id,
    label: 'Teflon tape',
  },
  {
    re: /\bsilicone(?:\s+(?:sealant|caulk))?\b/id,
    label: 'Silicone sealant',
  },
]

/* ─── Stopwords for client-name extraction ────────────────────────────── */

/**
 * Reject these as client names. Live STT lowercases everything, so the
 * "first capitalized word after at/chez" heuristic gives up — instead we
 * accept any word and filter common false positives.
 */
const STOP_CLIENT_EN = new Set([
  'home', 'work', 'lunch', 'noon', 'least', 'last', 'most', 'first',
  'hardware', 'store', 'shop', 'site', 'job', 'place', 'property',
  'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight',
  'today', 'yesterday', 'tomorrow', 'morning', 'afternoon', 'evening',
])
const STOP_CLIENT_FR = new Set([
  'maison', 'midi', 'quincaillerie', 'magasin', 'chantier', 'place',
  'site', 'job', 'shop', 'matin', 'après', 'soir',
])

/* ─── Span helpers ─────────────────────────────────────────────────────── */

type MatchWithIndices = RegExpExecArray & {
  indices?: Array<[number, number] | undefined>
}

function spanFromMatch(
  m: RegExpExecArray,
  groupIndex: number,
  kind: ParsedSpan['kind'],
  value: string,
): ParsedSpan | null {
  const idx = (m as MatchWithIndices).indices
  if (idx?.[groupIndex]) {
    const [start, end] = idx[groupIndex]!
    return { start, end, kind, value }
  }
  // Fallback: use the full match's start/end if `d` indices weren't present
  // for the requested group (defensive — all our regexes use `d`).
  if (m.index === undefined) return null
  return { start: m.index, end: m.index + m[0].length, kind, value }
}

function titleCase(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s
}

/* ─── Individual parsers ──────────────────────────────────────────────── */

interface ClientHit {
  value: string | null
  span: ParsedSpan | null
}

const FR_CLIENT_PATTERNS: RegExp[] = [
  /\bchez\s+(?:le\s+|la\s+|monsieur\s+|madame\s+|m\.?\s+|mme\.?\s+)?([\wÀ-ÿ][\wÀ-ÿ'-]*)/id,
  /\bpour\s+(?:le\s+|la\s+|monsieur\s+|madame\s+|m\.?\s+|mme\.?\s+)?([\wÀ-ÿ][\wÀ-ÿ'-]*)/id,
  /\b(?:chantier|job|place)\s+(?:de\s+|du\s+|chez\s+)?([\wÀ-ÿ][\wÀ-ÿ'-]*)/id,
  /\bfacturer\s+(?:à\s+)?(?:le\s+|la\s+|monsieur\s+|madame\s+|m\.?\s+|mme\.?\s+)?([\wÀ-ÿ][\wÀ-ÿ'-]*)/id,
]
const EN_CLIENT_PATTERNS: RegExp[] = [
  /\bat\s+(?:the\s+)?([a-z][\w-]*)(?:'s)?\b/id,
  /\bfor\s+(?:the\s+)?([a-z][\w-]*)(?:'s)?\b/id,
  /\bbill(?:ing)?\s+(?:for\s+)?(?:the\s+)?([a-z][\w-]*)\b/id,
  /\b([a-z][\w-]*)(?:'s)?\s+(?:job|place|property|residence)\b/id,
]

function parseClient(text: string, lang: Lang): ClientHit {
  const patterns = lang === 'fr' ? FR_CLIENT_PATTERNS : EN_CLIENT_PATTERNS
  const stop = lang === 'fr' ? STOP_CLIENT_FR : STOP_CLIENT_EN
  for (const re of patterns) {
    re.lastIndex = 0 // exec on /g would mutate this; defensive even though we don't use /g
    const m = re.exec(text)
    if (!m) continue
    const raw = m[1]
    if (!raw || stop.has(raw.toLowerCase())) continue
    const value = titleCase(raw)
    return { value, span: spanFromMatch(m, 1, 'client', value) }
  }
  return { value: null, span: null }
}

interface HoursHit {
  value: number | null
  span: ParsedSpan | null
}

function readNumberWord(raw: string, lang: Lang): number | null {
  const lower = raw.toLowerCase()
  const dict = lang === 'fr' ? FR_NUM_WORDS : EN_NUM_WORDS
  if (dict[lower] != null) return dict[lower]
  const n = Number(lower.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

/** Idiomatic / vague hour expressions. Order matters: more specific phrases
 *  appear before more generic ones to win the match. */
const EN_VAGUE_HOURS: Array<{ re: RegExp; value: number }> = [
  { re: /\b(?:full|whole|all)\s+day\b/id, value: 8 },
  { re: /\ball\s+morning\b/id, value: 4 },
  { re: /\ball\s+afternoon\b/id, value: 4 },
  { re: /\bhalf\s+(?:a\s+)?day\b/id, value: 4 },
  { re: /\bcouple\s+(?:of\s+)?hours?\b/id, value: 2 },
  { re: /\bfew\s+hours?\b/id, value: 3 },
  { re: /\bhalf\s+(?:an\s+)?hour\b/id, value: 0.5 },
  { re: /\bquarter\s+(?:of\s+an?\s+)?hour\b/id, value: 0.25 },
  { re: /\ban?\s+hour\b/id, value: 1 },
]
const FR_VAGUE_HOURS: Array<{ re: RegExp; value: number }> = [
  { re: /\b(?:toute\s+la\s+|une\s+)?journée(?:\s+complète)?\b/id, value: 8 },
  { re: /\btoute\s+la\s+matinée\b/id, value: 4 },
  { re: /\btout\s+l['' ]?après-midi\b/id, value: 4 },
  { re: /\b(?:une\s+)?demi-journée\b/id, value: 4 },
  { re: /\bquelques\s+heures\b/id, value: 3 },
  { re: /\bune\s+couple\s+(?:d['' ]?heures?)?\b/id, value: 2 },
  { re: /\b(?:une\s+)?demi[- ]heure\b/id, value: 0.5 },
  { re: /\bun\s+quart\s+d['' ]?heure\b/id, value: 0.25 },
  { re: /\bune\s+heure\b/id, value: 1 },
]

function parseHours(text: string, lang: Lang): HoursHit {
  // 1. Compound — "two and a half hours" / "deux heures et demie"
  if (lang === 'en') {
    const m = /\b(\d+(?:[.,]\d+)?|one|two|three|four|five|six|seven|eight|nine|ten)\s+and\s+a\s+(half|quarter)\s+hours?\b/id.exec(
      text,
    )
    if (m) {
      const base = readNumberWord(m[1], 'en')
      if (base !== null) {
        const value = base + (m[2].toLowerCase() === 'half' ? 0.5 : 0.25)
        return { value, span: spanFromMatch(m, 0, 'hours', `${value}h`) }
      }
    }
    // 1b. "1h30" / "2h45" notation
    const hm = /\b(\d+)\s*h(?:rs?)?\s*(\d{1,2})\b/id.exec(text)
    if (hm) {
      const h = Number(hm[1])
      const mn = Number(hm[2])
      if (Number.isFinite(h) && Number.isFinite(mn) && mn < 60) {
        const value = h + mn / 60
        return { value, span: spanFromMatch(hm, 0, 'hours', `${value}h`) }
      }
    }
  } else {
    const m = /\b(\d+(?:[.,]\d+)?|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix)\s+heures?\s+et\s+(demi(?:e)?|quart)\b/id.exec(
      text,
    )
    if (m) {
      const base = readNumberWord(m[1], 'fr')
      if (base !== null) {
        const value = base + (m[2].toLowerCase().startsWith('demi') ? 0.5 : 0.25)
        return { value, span: spanFromMatch(m, 0, 'hours', `${value}h`) }
      }
    }
    const hm = /\b(\d+)\s*h(\d{1,2})\b/id.exec(text)
    if (hm) {
      const h = Number(hm[1])
      const mn = Number(hm[2])
      if (Number.isFinite(h) && Number.isFinite(mn) && mn < 60) {
        const value = h + mn / 60
        return { value, span: spanFromMatch(hm, 0, 'hours', `${value}h`) }
      }
    }
  }

  // 2. Vague idioms — "half day", "couple hours", "toute la matinée".
  const vague = lang === 'en' ? EN_VAGUE_HOURS : FR_VAGUE_HOURS
  for (const { re, value } of vague) {
    const m = re.exec(text)
    if (m) return { value, span: spanFromMatch(m, 0, 'hours', `${value}h`) }
  }

  // 3. Simple — "two hours" / "deux heures".
  const simple =
    lang === 'fr'
      ? /\b(\d+(?:[.,]\d+)?|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix)\s+heures?\b/id
      : /\b(\d+(?:[.,]\d+)?|one|two|three|four|five|six|seven|eight|nine|ten)\s+hours?\b/id
  const m = simple.exec(text)
  if (!m) return { value: null, span: null }
  const value = readNumberWord(m[1], lang)
  if (value === null) return { value: null, span: null }
  return { value, span: spanFromMatch(m, 0, 'hours', `${value}h`) }
}

interface MaterialHits {
  values: string[]
  spans: ParsedSpan[]
}

function parseMaterials(text: string, lang: Lang): MaterialHits {
  const matchers = lang === 'fr' ? FR_MATERIALS : EN_MATERIALS
  const values: string[] = []
  const spans: ParsedSpan[] = []
  for (const m of matchers) {
    const result = m.re.exec(text)
    if (!result || values.includes(m.label)) continue
    values.push(m.label)
    const span = spanFromMatch(result, 0, 'material', m.label)
    if (span) spans.push(span)
  }
  return { values, spans }
}

/**
 * Parse the (partial) transcript text into structured fields plus a list of
 * highlight spans. Called on every new word, so the caught-panel reveal
 * feels live.
 */
export function parseTranscript(text: string, lang: Lang): Extracted {
  if (!text.trim()) return EMPTY_EXTRACTED
  const c = parseClient(text, lang)
  const h = parseHours(text, lang)
  const m = parseMaterials(text, lang)
  const spans: ParsedSpan[] = []
  if (c.span) spans.push(c.span)
  if (h.span) spans.push(h.span)
  spans.push(...m.spans)
  // Sort so the renderer can walk text left-to-right and slice out highlights.
  spans.sort((a, b) => a.start - b.start)
  return {
    client: c.value,
    hours: h.value,
    materials: m.values,
    spans,
  }
}
