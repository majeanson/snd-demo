import { useEffect, useMemo, useRef, useState } from 'react'
import type { Extracted } from './parse'
import type { Lang } from './VoiceMemo'

/**
 * Hourly rate for labor lines. Hardcoded — a real product would let the
 * tradesperson set this per-trade in their profile. Same for the material
 * price book below.
 */
const HOURLY_RATE = 80

const GST_RATE = 0.05 // TPS — federal
const QST_RATE = 0.09975 // TVQ — provincial (Quebec)

const INVOICE_NUMBER = '2026-0042'

/**
 * Captured at module load so the demo's "today" date is stable across all
 * renders without having to call `new Date()` inside render (impure).
 */
const TODAY = new Date()

interface MaterialSpec {
  qty: number
  qtyUnit?: string
  unitPrice: number
  lineLabel: string
}

/**
 * Seeded prices — the voice memo doesn't mention dollar amounts, so the demo
 * fills in plausible Quebec hardware-store costs. The "draft — review before
 * sending" badge in the footer makes it clear these are starting points the
 * tradesperson is expected to verify.
 */
const MATERIAL_BOOK: Record<Lang, Record<string, MaterialSpec>> = {
  fr: {
    'vis 3,5"': { qty: 50, qtyUnit: 'pcs', unitPrice: 0.18, lineLabel: 'Vis 3,5" (boîte de 50)' },
    'vis 2"': { qty: 50, qtyUnit: 'pcs', unitPrice: 0.14, lineLabel: 'Vis 2" (boîte de 50)' },
    'vis 4"': { qty: 25, qtyUnit: 'pcs', unitPrice: 0.32, lineLabel: 'Vis 4" (boîte de 25)' },
    'tee PVC': { qty: 1, unitPrice: 4.95, lineLabel: 'Tee PVC ¾"' },
    'coude PVC': { qty: 1, unitPrice: 3.45, lineLabel: 'Coude PVC ¾"' },
    'manchon PVC': { qty: 1, unitPrice: 1.95, lineLabel: 'Manchon PVC ¾"' },
    'valve PVC': { qty: 1, unitPrice: 14.95, lineLabel: 'Valve PVC à bille ¾"' },
    'colle PVC': { qty: 1, unitPrice: 9.95, lineLabel: 'Colle PVC (petite canette)' },
    'ruban Téflon': { qty: 1, unitPrice: 2.45, lineLabel: 'Ruban Téflon (rouleau)' },
    'silicone': { qty: 1, unitPrice: 7.95, lineLabel: 'Scellant silicone (tube)' },
  },
  en: {
    '3.5" screws': { qty: 50, qtyUnit: 'pcs', unitPrice: 0.18, lineLabel: '3.5" screws (box of 50)' },
    '2" screws': { qty: 50, qtyUnit: 'pcs', unitPrice: 0.14, lineLabel: '2" screws (box of 50)' },
    '4" screws': { qty: 25, qtyUnit: 'pcs', unitPrice: 0.32, lineLabel: '4" screws (box of 25)' },
    'PVC tee': { qty: 1, unitPrice: 4.95, lineLabel: 'PVC tee ¾"' },
    'PVC elbow': { qty: 1, unitPrice: 3.45, lineLabel: 'PVC elbow ¾"' },
    'PVC coupling': { qty: 1, unitPrice: 1.95, lineLabel: 'PVC coupling ¾"' },
    'PVC ball valve': { qty: 1, unitPrice: 14.95, lineLabel: 'PVC ball valve ¾"' },
    'PVC cement': { qty: 1, unitPrice: 9.95, lineLabel: 'PVC cement (small can)' },
    'Teflon tape': { qty: 1, unitPrice: 2.45, lineLabel: 'Teflon tape (roll)' },
    'Silicone sealant': { qty: 1, unitPrice: 7.95, lineLabel: 'Silicone sealant (tube)' },
  },
}

interface InvoiceLine {
  key: string
  description: string
  qtyDisplay: string
  unitPrice: number
  total: number
}

interface InvoiceLabels {
  draftStamp: string
  date: string
  from: string
  fromName: string
  fromBiz: string
  fromMeta: string
  to: string
  toPending: string
  toAddrPending: string
  colDesc: string
  colQty: string
  colUnit: string
  colTotal: string
  laborDesc: string
  hoursUnit: string
  subtotal: string
  gst: string
  qst: string
  total: string
  terms: string
  send: string
  sending: string
  sent: (email: string) => string
  download: string
  draftBadge: string
  emptyHint: string
  sentEmail: string
  downloadHint: string
  recapPrefix: string
  recapClient: string
  recapHours: (h: string) => string
  recapMaterials: (n: number) => string
  recapTail: string
}

const LABELS: Record<Lang, InvoiceLabels> = {
  fr: {
    draftStamp: 'Facture · brouillon',
    date: 'Émise le',
    from: 'De',
    fromName: 'Marc Jeanson',
    fromBiz: 'Plomberie & PVC',
    fromMeta: 'NEQ 1234567890',
    to: 'À facturer',
    toPending: '(client à confirmer)',
    toAddrPending: '(adresse à venir)',
    colDesc: 'Description',
    colQty: 'Qté',
    colUnit: 'Prix unit.',
    colTotal: 'Total',
    laborDesc: "Main d'œuvre",
    hoursUnit: 'h',
    subtotal: 'Sous-total',
    gst: 'TPS (5 %)',
    qst: 'TVQ (9,975 %)',
    total: 'Total',
    terms: 'Modalités · payable sur 30 jours · intérêts 1,5 %/mois après échéance',
    send: 'Envoyer au client',
    sending: 'Envoi…',
    sent: (email) => `Envoyée à ${email}`,
    download: 'Télécharger PDF',
    draftBadge: 'brouillon — à valider avant envoi',
    emptyHint: 'Les lignes apparaissent à mesure qu’on capte les heures et les matériaux…',
    sentEmail: 'jean.tremblay@example.qc',
    downloadHint: 'Imprimer ou enregistrer en PDF',
    recapPrefix: 'Capté',
    recapClient: '1 client',
    recapHours: (h: string) => `${h} h main d'œuvre`,
    recapMaterials: (n: number) => `${n} matériau${n > 1 ? 'x' : ''}`,
    recapTail: 'prêt à intégrer',
  },
  en: {
    draftStamp: 'Invoice · draft',
    date: 'Issued',
    from: 'From',
    fromName: 'Marc Jeanson',
    fromBiz: 'Plumbing & PVC',
    fromMeta: 'NEQ 1234567890',
    to: 'Bill to',
    toPending: '(client to confirm)',
    toAddrPending: '(address pending)',
    colDesc: 'Description',
    colQty: 'Qty',
    colUnit: 'Unit price',
    colTotal: 'Total',
    laborDesc: 'Labor',
    hoursUnit: 'h',
    subtotal: 'Subtotal',
    gst: 'GST (5%)',
    qst: 'QST (9.975%)',
    total: 'Total',
    terms: 'Terms · net 30 · 1.5%/mo interest after due date',
    send: 'Send to client',
    sending: 'Sending…',
    sent: (email) => `Sent to ${email}`,
    download: 'Download PDF',
    draftBadge: 'draft — review before sending',
    emptyHint: 'Lines fill in as we catch the hours and materials…',
    sentEmail: 'jean.tremblay@example.qc',
    downloadHint: 'Print or save as PDF',
    recapPrefix: 'Captured',
    recapClient: '1 client',
    recapHours: (h: string) => `${h} h labor`,
    recapMaterials: (n: number) => `${n} material${n > 1 ? 's' : ''}`,
    recapTail: 'ready to ship',
  },
}

function formatMoney(n: number, lang: Lang): string {
  return n.toLocaleString(lang === 'fr' ? 'fr-CA' : 'en-CA', {
    style: 'currency',
    currency: 'CAD',
  })
}

/**
 * Eases a number from `from` to `to` over `duration` ms via rAF and writes the
 * current value into a string state. Standalone hook so the Total amount can
 * count up smoothly without coupling to React's render-per-frame model.
 */
function useCountUp(target: number, lang: Lang, duration = 520): string {
  const [display, setDisplay] = useState(target)
  const fromRef = useRef(target)
  const startedAtRef = useRef<number | null>(null)

  useEffect(() => {
    fromRef.current = display
    startedAtRef.current = null
    let raf = 0
    const tick = (now: number) => {
      if (startedAtRef.current === null) startedAtRef.current = now
      const t = Math.min(1, (now - startedAtRef.current) / duration)
      // easeOutCubic — fast start, soft landing on the final value.
      const eased = 1 - Math.pow(1 - t, 3)
      const v = fromRef.current + (target - fromRef.current) * eased
      setDisplay(v)
      if (t < 1) raf = requestAnimationFrame(tick)
      else setDisplay(target)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // `display` deliberately excluded — it changes every frame and would
    // restart the animation. We snapshot it into fromRef on each new target.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration])

  return formatMoney(display, lang)
}

function formatToday(lang: Lang): string {
  return TODAY.toLocaleDateString(lang === 'fr' ? 'fr-CA' : 'en-CA', { dateStyle: 'long' })
}

function formatHours(n: number, lang: Lang): string {
  // Use locale decimal separator (FR uses comma) and trim trailing zeroes.
  return n.toLocaleString(lang === 'fr' ? 'fr-CA' : 'en-CA', { maximumFractionDigits: 2 })
}

function buildLines(extracted: Extracted, lang: Lang): InvoiceLine[] {
  const lines: InvoiceLine[] = []

  if (extracted.hours !== null && extracted.hours > 0) {
    const hours = extracted.hours
    lines.push({
      key: 'labor',
      description: LABELS[lang].laborDesc,
      qtyDisplay: `${formatHours(hours, lang)} ${LABELS[lang].hoursUnit}`,
      unitPrice: HOURLY_RATE,
      total: hours * HOURLY_RATE,
    })
  }

  for (const m of extracted.materials) {
    const spec = MATERIAL_BOOK[lang][m]
    if (!spec) continue
    lines.push({
      key: `mat-${m}`,
      description: spec.lineLabel,
      qtyDisplay: spec.qtyUnit ? `${spec.qty} ${spec.qtyUnit}` : `${spec.qty}`,
      unitPrice: spec.unitPrice,
      total: spec.qty * spec.unitPrice,
    })
  }

  return lines
}

type SendState = 'idle' | 'sending' | 'sent'

export function InvoiceDraft({ extracted, lang }: { extracted: Extracted; lang: Lang }) {
  const labels = LABELS[lang]
  const lines = useMemo(() => buildLines(extracted, lang), [extracted, lang])

  const subtotal = lines.reduce((s, l) => s + l.total, 0)
  const gst = subtotal * GST_RATE
  const qst = subtotal * QST_RATE
  const total = subtotal + gst + qst
  const animatedTotal = useCountUp(total, lang)

  // The same "complete enough to be useful" predicate the Metric uses:
  // client + hours + at least one material. Drives the sparkle moment on the
  // DRAFT stamp so the polish lands exactly when the parser finishes its job.
  const complete =
    extracted.client !== null && extracted.hours !== null && extracted.materials.length >= 1

  const [sendState, setSendState] = useState<SendState>('idle')
  // Cancel any in-flight "sending…" timer if the component unmounts or gets
  // reset by a replay so we never set state on an unmounted node.
  const sendTimerRef = useRef<number | null>(null)
  useEffect(() => {
    return () => {
      if (sendTimerRef.current !== null) window.clearTimeout(sendTimerRef.current)
    }
  }, [])
  // Reset the send state when the parser resets to empty (replay from zero).
  useEffect(() => {
    if (lines.length === 0) setSendState('idle')
  }, [lines.length])

  // Smooth-scroll the invoice into view once it transitions to complete.
  // Guarded so we only scroll on the *first* completion (not on every line
  // change after) — no fighting the user if they manually scrolled away.
  const articleRef = useRef<HTMLElement>(null)
  const scrolledRef = useRef(false)
  useEffect(() => {
    if (!complete) {
      // Reset on replay so the next completion can scroll again.
      scrolledRef.current = false
      return
    }
    if (scrolledRef.current) return
    scrolledRef.current = true
    // rAF lets the layout settle (fade-in + sparkle starting) before we move.
    requestAnimationFrame(() => {
      articleRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
  }, [complete])

  const onDownload = () => {
    if (!complete) return
    window.print()
  }

  const onSend = () => {
    if (!complete || sendState !== 'idle') return
    setSendState('sending')
    sendTimerRef.current = window.setTimeout(() => {
      setSendState('sent')
      sendTimerRef.current = null
    }, 700)
  }

  return (
    <>
    <article ref={articleRef} className={`invoice${complete ? ' invoice--complete' : ''}`} aria-label={labels.draftStamp}>
      <div className="invoice__perforation" aria-hidden="true">
        <span className="invoice__perf-icon">✂</span>
        <span className="invoice__perf-line" />
      </div>

      <header className="invoice__head">
        <div className="invoice__head-left">
          <p className="invoice__stamp mono">
            {labels.draftStamp}
            {/* Sparkle layer — purely decorative, fires once per "complete"
                transition via key change so CSS animation re-runs. */}
            {complete && (
              <span className="invoice__sparkle" key={`spark-${lines.length}`} aria-hidden="true">
                <span className="invoice__sparkle-dot invoice__sparkle-dot--a" />
                <span className="invoice__sparkle-dot invoice__sparkle-dot--b" />
                <span className="invoice__sparkle-dot invoice__sparkle-dot--c" />
                <span className="invoice__sparkle-dot invoice__sparkle-dot--d" />
              </span>
            )}
          </p>
          <p className="invoice__date mono">
            {labels.date} {formatToday(lang)}
          </p>
        </div>
        <div className="invoice__num mono">#{INVOICE_NUMBER}</div>
      </header>

      <div className="invoice__parties">
        <div className="invoice__party">
          <span className="invoice__party-label mono">{labels.from}</span>
          <p className="invoice__party-name">{labels.fromName}</p>
          <p className="invoice__party-meta">{labels.fromBiz}</p>
          <p className="invoice__party-meta mono">{labels.fromMeta}</p>
        </div>
        <div className="invoice__party invoice__party--to">
          <span className="invoice__party-label mono">{labels.to}</span>
          {/* Keying on the detected client forces a fresh DOM node so the
              fade-in animation re-runs the moment the parser fills it in. */}
          <p className="invoice__party-name" key={extracted.client ?? '__pending'}>
            {extracted.client ?? <span className="invoice__pending">{labels.toPending}</span>}
          </p>
          <p className="invoice__party-meta invoice__pending">{labels.toAddrPending}</p>
        </div>
      </div>

      <table className="invoice__table">
        <colgroup>
          <col className="invoice__col-desc" />
          <col className="invoice__col-num" />
          <col className="invoice__col-num" />
          <col className="invoice__col-num" />
        </colgroup>
        <thead>
          <tr>
            <th scope="col" className="invoice__th invoice__th-desc">
              {labels.colDesc}
            </th>
            <th scope="col" className="invoice__th invoice__th-num">
              {labels.colQty}
            </th>
            <th scope="col" className="invoice__th invoice__th-num">
              {labels.colUnit}
            </th>
            <th scope="col" className="invoice__th invoice__th-num">
              {labels.colTotal}
            </th>
          </tr>
        </thead>
        <tbody>
          {lines.length === 0 ? (
            <tr className="invoice__line invoice__line--empty">
              <td colSpan={4} className="invoice__pending invoice__empty-hint">
                {labels.emptyHint}
              </td>
            </tr>
          ) : (
            lines.map((l) => (
              <tr key={l.key} className="invoice__line">
                <td className="invoice__td invoice__td-desc">{l.description}</td>
                <td className="invoice__td invoice__td-num mono">{l.qtyDisplay}</td>
                <td className="invoice__td invoice__td-num mono">{formatMoney(l.unitPrice, lang)}</td>
                <td className="invoice__td invoice__td-num mono invoice__line-total">
                  {formatMoney(l.total, lang)}
                </td>
              </tr>
            ))
          )}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={3} className="invoice__sum-label">
              {labels.subtotal}
            </td>
            <td className="invoice__td invoice__td-num mono">{formatMoney(subtotal, lang)}</td>
          </tr>
          <tr>
            <td colSpan={3} className="invoice__sum-label">
              {labels.gst}
            </td>
            <td className="invoice__td invoice__td-num mono">{formatMoney(gst, lang)}</td>
          </tr>
          <tr>
            <td colSpan={3} className="invoice__sum-label">
              {labels.qst}
            </td>
            <td className="invoice__td invoice__td-num mono">{formatMoney(qst, lang)}</td>
          </tr>
          <tr className="invoice__total-row">
            <td colSpan={3} className="invoice__sum-label invoice__sum-label--total">
              {labels.total}
            </td>
            <td className="invoice__td invoice__td-num mono invoice__total-amount">
              {animatedTotal}
            </td>
          </tr>
        </tfoot>
      </table>

      <footer className="invoice__foot">
        <p className="invoice__terms">{labels.terms}</p>
        <div className="invoice__send-wrap">
          <button
            type="button"
            className={`invoice__btn invoice__btn--ghost${complete ? ' invoice__btn--live' : ''}`}
            onClick={onDownload}
            disabled={!complete}
            aria-disabled={!complete}
            title={complete ? labels.downloadHint : labels.draftBadge}
          >
            <span className="invoice__btn-icon" aria-hidden="true">
              ↓
            </span>
            {labels.download}
          </button>
          {sendState === 'sent' ? (
            <span className="invoice__sent" role="status" aria-live="polite">
              <span className="invoice__sent-icon" aria-hidden="true">
                ✓
              </span>
              {labels.sent(labels.sentEmail)}
            </span>
          ) : (
            <button
              type="button"
              className={`invoice__btn invoice__btn--primary${complete ? ' invoice__btn--live' : ''}`}
              onClick={onSend}
              disabled={!complete || sendState === 'sending'}
              aria-disabled={!complete || sendState === 'sending'}
              title={complete ? '' : labels.draftBadge}
            >
              {sendState === 'sending' ? (
                <>
                  <span className="invoice__btn-spinner" aria-hidden="true" />
                  {labels.sending}
                </>
              ) : (
                <>
                  {labels.send}
                  <span className="invoice__btn-icon" aria-hidden="true">
                    →
                  </span>
                </>
              )}
            </button>
          )}
          {sendState !== 'sent' && (
            <span className="invoice__send-badge mono">{labels.draftBadge}</span>
          )}
        </div>
      </footer>
    </article>
    {sendState === 'sent' && extracted.hours !== null && (
      <p className="invoice-recap mono" role="status">
        <span className="invoice-recap__label">{labels.recapPrefix}</span>
        <span className="invoice-recap__items">
          <span>{labels.recapClient}</span>
          <span aria-hidden="true">·</span>
          <span>{labels.recapHours(formatHours(extracted.hours, lang))}</span>
          <span aria-hidden="true">·</span>
          <span>{labels.recapMaterials(extracted.materials.length)}</span>
        </span>
        <span className="invoice-recap__tail">{labels.recapTail}</span>
      </p>
    )}
    </>
  )
}
