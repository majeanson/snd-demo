import { useEffect, useRef, useState } from 'react'

export type Lang = 'fr' | 'en'

interface MemoLabels {
  stamp: string
  location: string
  hint: string
  play: string
  pause: string
  replay: string
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
      hint: 'Note vocale prise dans le truck. Joue pour voir le transcript.',
      play: 'écouter',
      pause: 'pause',
      replay: 'rejouer',
    },
  },
  en: {
    duration: MEMO_EN_SCRIPT.duration,
    words: MEMO_EN_SCRIPT.words,
    labels: {
      stamp: 'thu 2:32 pm',
      location: 'on the 138 toward Tadoussac',
      hint: 'Voice note recorded in the truck. Press play to see the transcript.',
      play: 'play',
      pause: 'pause',
      replay: 'replay',
    },
  },
}

function formatClock(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

/**
 * Simulated voice memo player. No real audio — the playback time is driven by
 * a requestAnimationFrame loop, and the transcript reveals word-by-word using
 * the precomputed `at` offsets. Honest demo: the point is the voice→text UX,
 * not actual audio decoding.
 */
export function VoiceMemo({ lang }: { lang: Lang }) {
  const memo = MEMOS[lang]
  const [elapsed, setElapsed] = useState(0)
  const [playing, setPlaying] = useState(false)
  // Track playback start time anchored to the current `elapsed`. Stored in a
  // ref so resuming from pause doesn't restart the loop's anchor each render.
  const startedAtRef = useRef<number>(0)

  // If the language flips mid-playback, reset to a clean state — otherwise the
  // word array swaps under us and indices/timings drift.
  useEffect(() => {
    setElapsed(0)
    setPlaying(false)
  }, [lang])

  useEffect(() => {
    if (!playing) return
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
    // We deliberately omit `elapsed` from deps: it changes every frame and
    // would re-run the effect (cancelling the loop) on every tick. The anchor
    // captured at effect-start handles resume-from-pause correctly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, memo.duration])

  const finished = elapsed >= memo.duration
  const progress = Math.min(1, elapsed / memo.duration)

  const onToggle = () => {
    if (finished) {
      setElapsed(0)
      setPlaying(true)
      return
    }
    setPlaying((p) => !p)
  }

  const buttonLabel = finished ? memo.labels.replay : playing ? memo.labels.pause : memo.labels.play

  return (
    <section className="memo" aria-label="voice memo">
      <header className="memo__head">
        <span className="memo__stamp mono">{memo.labels.stamp}</span>
        <span className="memo__loc">{memo.labels.location}</span>
      </header>

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
        <div className="memo__bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
          <div className="memo__bar-fill" style={{ width: `${progress * 100}%` }} />
        </div>
        <span className="memo__clock mono">
          {formatClock(elapsed)} <span className="memo__clock-sep">/</span> {formatClock(memo.duration)}
        </span>
      </div>

      <p className="memo__hint">{memo.labels.hint}</p>

      <div className="memo__transcript" aria-live="polite" aria-atomic="false">
        {memo.words.map((w, i) => {
          const visible = w.at <= elapsed
          const isLatest = visible && (i === memo.words.length - 1 || memo.words[i + 1].at > elapsed)
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
              {w.text}{' '}
            </span>
          )
        })}
      </div>
    </section>
  )
}
