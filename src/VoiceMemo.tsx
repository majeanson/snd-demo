import { useEffect, useMemo, useRef, useState } from 'react'
import { LiveRecorder } from './LiveRecorder'
import { MATERIAL_DISPLAY, parseTranscript, type Extracted } from './parse'
import { useSpeechRecognition, type SpeechLang } from './useSpeechRecognition'

export type Lang = 'fr' | 'en'

export type Mode = 'sample' | 'live'

function toSpeechLang(lang: Lang): SpeechLang {
  return lang === 'fr' ? 'fr-CA' : 'en-CA'
}

interface MemoLabels {
  stamp: string
  location: string
  hint: string
  play: string
  pause: string
  replay: string
  caughtTitle: string
  clientLabel: string
  hoursLabel: string
  materialsLabel: string
  hoursUnit: (n: number) => string
  pending: string
  shortcutHint: string
  modeSample: string
  modeLive: string
  modeLiveUnsupportedBadge: string
}

/**
 * Word + cumulative `at` (ms from playback start). Rev 03 will add tag fields
 * here so the parser can highlight materials/hours; Rev 02 keeps it neutral.
 */
interface Word {
  text: string
  at: number
}

interface Memo {
  duration: number
  labels: MemoLabels
  words: Word[]
}

/**
 * Build a Word[] from `[text, gapBeforePreviousMs]` tuples by accumulating the
 * gaps. Keeps the script readable instead of forcing every entry to carry a
 * pre-computed `at` value.
 */
function script(entries: Array<[string, number]>): { words: Word[]; duration: number } {
  let at = 0
  const words = entries.map(([text, gap]) => {
    at += gap
    return { text, at }
  })
  // Tail pause after the last word so the bar finishes filling visibly.
  return { words, duration: at + 600 }
}

const MEMO_FR_SCRIPT = script([
  ['Bon...', 700],
  ['asteure', 420],
  ["j'me", 280],
  ['ramasse', 360],
  ['chez', 280],
  ['Tremblay.', 380],
  ['Deux', 620],
  ['heures', 320],
  ['sur', 220],
  ['la', 200],
  ['run.', 380],
  ['Plus', 600],
  ['le', 200],
  ['détour', 380],
  ['quincaillerie.', 480],
  ['Vis', 700],
  ['trois', 380],
  ['et', 240],
  ['demi.', 380],
  ['Pis', 600],
  ['le', 200],
  ['tee', 320],
  ['PVC.', 380],
])

const MEMO_EN_SCRIPT = script([
  ['Alright...', 720],
  ['wrapping', 380],
  ['up', 240],
  ['at', 220],
  ["Tremblay's.", 420],
  ['Two', 620],
  ['hours', 320],
  ['on', 220],
  ['the', 200],
  ['run.', 380],
  ['Plus', 600],
  ['a', 200],
  ['detour', 380],
  ['to', 220],
  ['the', 200],
  ['hardware', 360],
  ['store.', 460],
  ['Three-and-a-half-inch', 700],
  ['screws.', 460],
  ['And', 580],
  ['the', 200],
  ['PVC', 320],
  ['tee.', 380],
])

const MEMOS: Record<Lang, Memo> = {
  fr: {
    duration: MEMO_FR_SCRIPT.duration,
    words: MEMO_FR_SCRIPT.words,
    labels: {
      stamp: 'jeu. 14 h 32',
      location: 'sur la 138 vers Tadoussac',
      hint: 'Note vocale prise dans le truck. Joue pour voir ce qu’on en tire.',
      play: 'écouter',
      pause: 'pause',
      replay: 'rejouer',
      caughtTitle: 'Ce qu’on a capté',
      clientLabel: 'Client',
      hoursLabel: 'Heures',
      materialsLabel: 'Matériaux',
      hoursUnit: (n) => `${formatNumber(n, 'fr')} h`,
      pending: '—',
      shortcutHint: 'lecture/pause',
      modeSample: 'Échantillon',
      modeLive: 'Ta voix',
      modeLiveUnsupportedBadge: 'non pris en charge',
    },
  },
  en: {
    duration: MEMO_EN_SCRIPT.duration,
    words: MEMO_EN_SCRIPT.words,
    labels: {
      stamp: 'thu 2:32 pm',
      location: 'on the 138 toward Tadoussac',
      hint: 'Voice note recorded in the truck. Press play to watch what we pull out.',
      play: 'play',
      pause: 'pause',
      replay: 'replay',
      caughtTitle: 'What we caught',
      clientLabel: 'Client',
      hoursLabel: 'Hours',
      materialsLabel: 'Materials',
      hoursUnit: (n) => `${formatNumber(n, 'en')} h`,
      pending: '—',
      shortcutHint: 'play/pause',
      modeSample: 'Sample',
      modeLive: 'Your voice',
      modeLiveUnsupportedBadge: 'unsupported',
    },
  },
}

function formatNumber(n: number, lang: Lang): string {
  if (Number.isInteger(n)) return String(n)
  return lang === 'fr' ? n.toString().replace('.', ',') : n.toString()
}

function formatClock(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function countVisible(words: Word[], elapsed: number): number {
  // Words are ordered by `at`, so the first one past elapsed is the boundary.
  for (let i = 0; i < words.length; i++) {
    if (words[i].at > elapsed) return i
  }
  return words.length
}

/**
 * Voice memo widget — two modes:
 *  - `sample`: prerecorded script revealed word-by-word via a rAF loop. The
 *    point of the demo is the voice→text UX, not real audio decoding.
 *  - `live`: streams the browser's `SpeechRecognition` output into the same
 *    parser, so users can try their own voice. See `LiveRecorder.tsx`.
 *
 * Both modes feed a single parsed `Extracted` value up to the parent — the
 * invoice draft and metric chip don't care which source the text came from.
 */
export function VoiceMemo({
  lang,
  onExtractedChange,
}: {
  lang: Lang
  /** Fires whenever the parser's view of the transcript changes. Lets a
   * sibling (Rev 04: InvoiceDraft) react without owning the playback. */
  onExtractedChange?: (extracted: Extracted) => void
}) {
  const memo = MEMOS[lang]
  const [mode, setMode] = useState<Mode>('sample')

  // === Sample-mode state ================================================
  const [elapsed, setElapsed] = useState(0)
  const [playing, setPlaying] = useState(false)
  // Track playback start time anchored to the current `elapsed`. Stored in a
  // ref so resuming from pause doesn't restart the loop's anchor each render.
  const startedAtRef = useRef<number>(0)

  // === Live-mode state ==================================================
  const speech = useSpeechRecognition(toSpeechLang(lang))

  // If the language flips mid-playback, reset to a clean state — otherwise the
  // word array swaps under us and indices/timings drift.
  useEffect(() => {
    setElapsed(0)
    setPlaying(false)
  }, [lang])

  // rAF playback loop — only runs while sample mode is actively playing.
  useEffect(() => {
    if (!playing || mode !== 'sample') return
    startedAtRef.current = performance.now() - elapsed
    let raf = 0
    const tick = (now: number) => {
      const e = now - startedAtRef.current
      if (e >= memo.duration) {
        setElapsed(memo.duration)
        setPlaying(false)
        return
      }
      setElapsed(e)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // `elapsed` deliberately excluded — it changes every frame and would
    // cancel the loop on each tick. The anchor captured at effect-start
    // handles resume-from-pause correctly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, memo.duration, mode])

  const finished = elapsed >= memo.duration
  const progress = Math.min(1, elapsed / memo.duration)

  // Count of words spoken so far. Recomputed every frame, but cheap (n=23).
  const visibleCount = countVisible(memo.words, elapsed)

  // Active text source: sample's revealed words, OR live's combined
  // (finalized + interim) transcript. The parser doesn't know which.
  const activeText = useMemo(() => {
    if (mode === 'sample') {
      return memo.words
        .slice(0, visibleCount)
        .map((w) => w.text)
        .join(' ')
    }
    return speech.combinedText
  }, [mode, memo.words, visibleCount, speech.combinedText])

  const extracted = useMemo(
    () => parseTranscript(activeText, lang),
    [activeText, lang],
  )

  // Mirror the parser's output to the parent so siblings can render off it.
  // Effect keeps render pure; the parent gets one update per memoized change.
  useEffect(() => {
    onExtractedChange?.(extracted)
  }, [extracted, onExtractedChange])

  /** Switch input source. Resets the source we're leaving so re-entering it
   *  starts from a clean state — otherwise the caught panel would carry
   *  stale extracts across modes. */
  const switchMode = (next: Mode) => {
    if (next === mode) return
    if (next === 'sample') {
      // Leaving live → stop the recognition cleanly.
      speech.reset()
    } else {
      // Leaving sample → freeze the player and rewind.
      setPlaying(false)
      setElapsed(0)
    }
    setMode(next)
  }

  const onToggle = () => {
    if (finished) {
      setElapsed(0)
      setPlaying(true)
      return
    }
    setPlaying((p) => !p)
  }

  // Space toggles the active input source — sample play/pause when in sample
  // mode, mic on/off when in live mode. Skipped when the user is typing in
  // a real input (e.g. the login modal email field). preventDefault stops
  // the page from scrolling on space, which matches media-player expectation.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' && e.key !== ' ') return
      const t = e.target as HTMLElement | null
      const tag = t?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || t?.isContentEditable) return
      e.preventDefault()
      if (mode === 'sample') {
        onToggle()
      } else if (speech.supported && speech.errorCode !== 'unsupported') {
        if (speech.state === 'listening' || speech.state === 'starting') {
          speech.stop()
        } else if (speech.state === 'error') {
          speech.reset()
          speech.start()
        } else {
          speech.start()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // Handlers use functional updaters / stable refs internally, so closure
    // drift on `onToggle` / `speech.*` is benign here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished, mode, speech.state, speech.supported, speech.errorCode])

  const buttonLabel = finished ? memo.labels.replay : playing ? memo.labels.pause : memo.labels.play

  const liveUnsupported = !speech.supported

  return (
    <section className="memo" aria-label="voice memo">
      <header className="memo__head">
        <span className="memo__stamp mono">{memo.labels.stamp}</span>
        <span className="memo__loc">{memo.labels.location}</span>
      </header>

      {/* Input-source toggle — sample (curated) vs live (your voice). Live
          stays clickable even when unsupported so the LiveRecorder can
          render the explanation rather than silently disabling. */}
      <div className="memo__mode" role="tablist" aria-label="input source">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'sample'}
          className={`memo__mode-btn${mode === 'sample' ? ' memo__mode-btn--active' : ''}`}
          onClick={() => switchMode('sample')}
        >
          <span className="memo__mode-dot memo__mode-dot--sample" aria-hidden="true" />
          {memo.labels.modeSample}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'live'}
          className={`memo__mode-btn memo__mode-btn--live${mode === 'live' ? ' memo__mode-btn--active' : ''}`}
          onClick={() => switchMode('live')}
        >
          <span className="memo__mode-dot memo__mode-dot--live" aria-hidden="true" />
          {memo.labels.modeLive}
          {liveUnsupported && (
            <span className="memo__mode-badge mono" aria-hidden="true">
              {memo.labels.modeLiveUnsupportedBadge}
            </span>
          )}
        </button>
      </div>

      {mode === 'live' ? (
        <LiveRecorder speech={speech} lang={lang} extracted={extracted} />
      ) : (
      <>
      <div className="memo__player">
        <button
          type="button"
          className="memo__play"
          onClick={onToggle}
          aria-pressed={playing}
          aria-label={buttonLabel}
        >
          <span className="memo__play-icon" aria-hidden="true">
            {finished ? '↻' : playing ? '❚❚' : '▶'}
          </span>
        </button>
        {/* Decorative EQ bars — animation only runs while `playing`, so paused
            and finished states freeze them. Sells "real audio player" without
            requiring an actual audio element. */}
        <div
          className={`memo__eq${playing ? ' memo__eq--playing' : ''}`}
          aria-hidden="true"
        >
          <span className="memo__eq-bar" />
          <span className="memo__eq-bar" />
          <span className="memo__eq-bar" />
          <span className="memo__eq-bar" />
        </div>
        <div className="memo__bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
          <div className="memo__bar-fill" style={{ width: `${progress * 100}%` }} />
        </div>
        <span className="memo__clock mono">
          {formatClock(elapsed)} <span className="memo__clock-sep">/</span> {formatClock(memo.duration)}
        </span>
      </div>

      <div className="memo__hint-row">
        <p className="memo__hint">{memo.labels.hint}</p>
        <span className="memo__shortcut mono" aria-hidden="true">
          <kbd className="memo__kbd">space</kbd>
          <span className="memo__shortcut-label">{memo.labels.shortcutHint}</span>
        </span>
      </div>

      <div className="memo__transcript" aria-live="polite" aria-atomic="false">
        {memo.words.map((w, i) => {
          const visible = w.at <= elapsed
          const isLatest = visible && (i === memo.words.length - 1 || memo.words[i + 1].at > elapsed)
          // Inline-block spans collapse adjacent whitespace text nodes, so
          // spacing is enforced via `margin-right` in CSS instead of a sibling
          // text node — survives both rendering and copy-paste.
          return (
            <span
              key={i}
              className={[
                'memo__word',
                visible ? 'memo__word--visible' : '',
                isLatest && playing ? 'memo__word--latest' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {w.text}
            </span>
          )
        })}
      </div>
      </>
      )}

      <aside className="caught" aria-label={memo.labels.caughtTitle}>
        <header className="caught__head">
          <span className="caught__eyebrow mono">{memo.labels.caughtTitle}</span>
        </header>
        <dl className="caught__list">
          <div className="caught__row">
            <dt className="caught__label mono">{memo.labels.clientLabel}</dt>
            {/* `key` on the value forces React to mount a fresh node when the
                detected value flips, which retriggers the fade-in animation. */}
            <dd className="caught__value" key={extracted.client ?? '__none'}>
              {extracted.client ?? <span className="caught__pending">{memo.labels.pending}</span>}
            </dd>
          </div>
          <div className="caught__row">
            <dt className="caught__label mono">{memo.labels.hoursLabel}</dt>
            <dd className="caught__value" key={extracted.hours ?? '__none'}>
              {extracted.hours != null ? (
                memo.labels.hoursUnit(extracted.hours)
              ) : (
                <span className="caught__pending">{memo.labels.pending}</span>
              )}
            </dd>
          </div>
          <div className="caught__row caught__row--multi">
            <dt className="caught__label mono">{memo.labels.materialsLabel}</dt>
            <dd className="caught__value">
              {extracted.materials.length > 0 ? (
                <ul className="caught__materials">
                  {extracted.materials.map((m) => (
                    <li key={m} className="caught__material">
                      {MATERIAL_DISPLAY[lang][m] ?? m}
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="caught__pending">{memo.labels.pending}</span>
              )}
            </dd>
          </div>
        </dl>
      </aside>
    </section>
  )
}
