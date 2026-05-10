import { useMemo } from 'react'
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
    'tee PVC': { qty: 1, unitPrice: 4.95, lineLabel: 'Tee PVC ¾"' },
    'coude PVC': { qty: 1, unitPrice: 3.45, lineLabel: 'Coude PVC ¾"' },
  },
  en: {
    '3.5" screws': { qty: 50, qtyUnit: 'pcs', unitPrice: 0.18, lineLabel: '3.5" screws (box of 50)' },
    'PVC tee': { qty: 1, unitPrice: 4.95, lineLabel: 'PVC tee ¾"' },
    'PVC elbow': { qty: 1, unitPrice: 3.45, lineLabel: 'PVC elbow ¾"' },
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
  draftBadge: string
  emptyHint: string
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
    draftBadge: 'brouillon — à valider avant envoi',
    emptyHint: 'Les lignes apparaissent à mesure qu’on capte les heures et les matériaux…',
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
    draftBadge: 'draft — review before sending',
    emptyHint: 'Lines fill in as we catch the hours and materials…',
  },
}

function formatMoney(n: number, lang: Lang): string {
  return n.toLocaleString(lang === 'fr' ? 'fr-CA' : 'en-CA', {
    style: 'currency',
    currency: 'CAD',
  })
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

export function InvoiceDraft({ extracted, lang }: { extracted: Extracted; lang: Lang }) {
  const labels = LABELS[lang]
  const lines = useMemo(() => buildLines(extracted, lang), [extracted, lang])

  const subtotal = lines.reduce((s, l) => s + l.total, 0)
  const gst = subtotal * GST_RATE
  const qst = subtotal * QST_RATE
  const total = subtotal + gst + qst

  return (
    <article className="invoice" aria-label={labels.draftStamp}>
      <div className="invoice__perforation" aria-hidden="true">
        <span className="invoice__perf-icon">✂</span>
        <span className="invoice__perf-line" />
      </div>

      <header className="invoice__head">
        <div className="invoice__head-left">
          <p className="invoice__stamp mono">{labels.draftStamp}</p>
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
              {formatMoney(total, lang)}
            </td>
          </tr>
        </tfoot>
      </table>

      <footer className="invoice__foot">
        <p className="invoice__terms">{labels.terms}</p>
        <div className="invoice__send-wrap">
          <button
            type="button"
            className="invoice__send"
            disabled
            aria-disabled="true"
            title={labels.draftBadge}
          >
            {labels.send}
          </button>
          <span className="invoice__send-badge mono">{labels.draftBadge}</span>
        </div>
      </footer>
    </article>
  )
}
