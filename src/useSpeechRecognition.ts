import { useCallback, useEffect, useRef, useState } from 'react'

/* ─────────────────────────────────────────────────────────────────────────
 * Web Speech API type shims. The `SpeechRecognition` interface is shipped by
 * Chrome/Edge/Safari (Safari only via the `webkitSpeechRecognition` alias)
 * but it is NOT in TypeScript's `lib.dom.d.ts` — we declare just enough of
 * it here to call the methods we use without `any`. Anything we don't touch
 * is omitted intentionally; this is a demo, not a reference shim.
 * ───────────────────────────────────────────────────────────────────────── */

interface SRAlternative {
  readonly transcript: string
  readonly confidence: number
}
interface SRResult {
  readonly isFinal: boolean
  readonly length: number
  readonly [index: number]: SRAlternative
}
interface SRResultList {
  readonly length: number
  readonly [index: number]: SRResult
}
interface SREvent extends Event {
  readonly resultIndex: number
  readonly results: SRResultList
}
interface SRErrorEvent extends Event {
  readonly error: string
  readonly message: string
}
interface SRInstance extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  maxAlternatives: number
  start(): void
  stop(): void
  abort(): void
  onstart: ((ev: Event) => void) | null
  onend: ((ev: Event) => void) | null
  onresult: ((ev: SREvent) => void) | null
  onerror: ((ev: SRErrorEvent) => void) | null
}
type SRCtor = new () => SRInstance

declare global {
  interface Window {
    SpeechRecognition?: SRCtor
    webkitSpeechRecognition?: SRCtor
  }
}

function getCtor(): SRCtor | null {
  if (typeof window === 'undefined') return null
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null
}

/* ─────────────────────────────────────────────────────────────────────────
 * Public hook surface
 * ───────────────────────────────────────────────────────────────────────── */

export type SpeechLang = 'fr-CA' | 'en-CA'
export type SpeechState = 'idle' | 'starting' | 'listening' | 'error'
export type SpeechErrorCode =
  | 'unsupported'
  | 'not-allowed'
  | 'no-mic'
  | 'network'
  | 'unknown'

export interface SpeechRecognitionHandle {
  /** True iff the browser exposes SpeechRecognition (any vendor prefix). */
  supported: boolean
  state: SpeechState
  errorCode: SpeechErrorCode | null
  /** Latest in-flight (non-final) chunk — replaced on each event. */
  interim: string
  /** Accumulated finalized text across the current session. */
  finalText: string
  /** `finalText` + a space + `interim`, trimmed. The parser eats this. */
  combinedText: string
  start: () => void
  stop: () => void
  reset: () => void
}

/**
 * Streaming wrapper around the browser's `SpeechRecognition`. Three things
 * justify a custom hook rather than calling SR inline:
 *
 *   1. Chrome ends sessions on ~60s of silence; we transparently re-`start()`
 *      via `onend` so the user keeps a single "listening" state.
 *   2. SR events come with closure-staleness traps (the handlers outlive
 *      renders); refs for `stopping`/`final` keep state coherent.
 *   3. Error codes from the spec aren't user-friendly — we collapse the
 *      relevant ones into `SpeechErrorCode` for the UI to switch on.
 */
export function useSpeechRecognition(lang: SpeechLang): SpeechRecognitionHandle {
  const [state, setState] = useState<SpeechState>('idle')
  const [errorCode, setErrorCode] = useState<SpeechErrorCode | null>(null)
  const [interim, setInterim] = useState('')
  const [finalText, setFinalText] = useState('')

  const recogRef = useRef<SRInstance | null>(null)
  // True when the user (or a fatal error) wants the session to end. Used by
  // `onend` to decide whether to auto-restart or settle to idle.
  const stoppingRef = useRef(false)
  // Mirrors `finalText` for use inside SR event handlers — `setFinalText`
  // alone wouldn't be visible to the next event firing in the same tick.
  const finalRef = useRef('')

  const supported = getCtor() !== null

  const teardown = useCallback(() => {
    const r = recogRef.current
    if (!r) return
    r.onstart = null
    r.onend = null
    r.onresult = null
    r.onerror = null
    try {
      r.abort()
    } catch {
      // already stopped — `abort` on an inactive recognition throws
    }
    recogRef.current = null
  }, [])

  const start = useCallback(() => {
    const Ctor = getCtor()
    if (!Ctor) {
      setErrorCode('unsupported')
      setState('error')
      return
    }

    // Rapid double-tap or restart-after-error: nuke any prior instance so
    // we don't get duplicate `onresult` events from a zombie session.
    teardown()
    setErrorCode(null)
    setFinalText('')
    setInterim('')
    finalRef.current = ''
    stoppingRef.current = false
    setState('starting')

    const recog = new Ctor()
    recog.continuous = true
    recog.interimResults = true
    recog.lang = lang
    recog.maxAlternatives = 1

    recog.onstart = () => setState('listening')

    recog.onresult = (ev) => {
      let interimChunk = ''
      let newFinal = ''
      // `resultIndex` is the first NEW result; earlier entries were already
      // processed in past events. Walk only the new ones.
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i]
        const transcript = r[0].transcript
        if (r.isFinal) {
          newFinal += (newFinal ? ' ' : '') + transcript.trim()
        } else {
          // Each event carries the latest interim; overwrite, don't append.
          interimChunk = transcript
        }
      }
      if (newFinal) {
        const merged = (finalRef.current + (finalRef.current ? ' ' : '') + newFinal).trim()
        finalRef.current = merged
        setFinalText(merged)
      }
      setInterim(interimChunk.trim())
    }

    recog.onerror = (ev) => {
      // `no-speech` is recoverable — Chrome fires it on silence then `onend`
      // follows; the auto-restart will handle it. `aborted` is user-initiated.
      if (ev.error === 'no-speech' || ev.error === 'aborted') return

      const map: Record<string, SpeechErrorCode> = {
        'not-allowed': 'not-allowed',
        'service-not-allowed': 'not-allowed',
        'audio-capture': 'no-mic',
        network: 'network',
      }
      setErrorCode(map[ev.error] ?? 'unknown')
      setState('error')
      // Block the auto-restart in `onend` for fatal errors.
      stoppingRef.current = true
    }

    recog.onend = () => {
      // If teardown swapped in a new session, this `onend` belongs to a
      // stale one — ignore it.
      if (recogRef.current !== recog) return
      if (!stoppingRef.current) {
        try {
          recog.start()
          return // stays "listening" — the auto-restart succeeded
        } catch {
          // `InvalidStateError` if the recognition is in a weird state.
          // Fall through and idle out.
        }
      }
      teardown()
      // Don't clobber an existing 'error' state on the way out.
      setState((s) => (s === 'error' ? 'error' : 'idle'))
    }

    recogRef.current = recog
    try {
      recog.start()
    } catch {
      setErrorCode('unknown')
      setState('error')
      teardown()
    }
  }, [lang, teardown])

  const stop = useCallback(() => {
    stoppingRef.current = true
    try {
      recogRef.current?.stop()
    } catch {
      // ignore — onend will fire either way
    }
    setInterim('')
  }, [])

  const reset = useCallback(() => {
    stoppingRef.current = true
    teardown()
    finalRef.current = ''
    setFinalText('')
    setInterim('')
    setErrorCode(null)
    setState('idle')
  }, [teardown])

  useEffect(() => {
    return () => {
      stoppingRef.current = true
      teardown()
    }
  }, [teardown])

  // Lang change ≠ in-place lang switch on a live recognition (the spec lets
  // you set `recognition.lang`, but mid-session it's flaky). Reset and let
  // the user retap to start in the new language.
  useEffect(() => {
    reset()
  }, [lang, reset])

  const combinedText = (finalText + (interim ? ' ' + interim : '')).trim()

  return {
    supported,
    state,
    errorCode,
    interim,
    finalText,
    combinedText,
    start,
    stop,
    reset,
  }
}
