import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { Lang } from './VoiceMemo'

interface LoginLabels {
  title: string
  intro: string
  emailLabel: string
  emailPlaceholder: string
  submit: string
  submitting: string
  cancel: string
  close: string
  unauthorizedTitle: string
  unauthorizedBody: string
  unauthorizedHint: string
}

const LABELS: Record<Lang, LoginLabels> = {
  fr: {
    title: 'Connexion client',
    intro:
      'Reçois un lien magique pour accéder à tes factures, ton historique et tes ententes.',
    emailLabel: 'Courriel',
    emailPlaceholder: 'jean.tremblay@example.qc',
    submit: 'Recevoir le lien',
    submitting: 'Envoi…',
    cancel: 'Annuler',
    close: 'Fermer',
    unauthorizedTitle: 'Accès refusé',
    unauthorizedBody:
      'Cette démo est publique — il n’y a pas de compte client à connecter.',
    unauthorizedHint:
      'En production, vos clients se connectent ici pour consulter leurs factures, leur historique et leurs ententes.',
  },
  en: {
    title: 'Client sign-in',
    intro: 'Get a magic link to access your invoices, history, and agreements.',
    emailLabel: 'Email',
    emailPlaceholder: 'jean.tremblay@example.qc',
    submit: 'Send magic link',
    submitting: 'Sending…',
    cancel: 'Cancel',
    close: 'Close',
    unauthorizedTitle: 'Unauthorized',
    unauthorizedBody: 'This is a public demo — there is no client account to sign in to.',
    unauthorizedHint:
      'In production, your clients sign in here to view their invoices, history, and agreements.',
  },
}

/**
 * Decorative login modal. Real-looking magic-link form; submit fakes a brief
 * "sending…" state then renders an Unauthorized message that explains what
 * production would do. Esc + backdrop click + Cancel all close the modal.
 */
export function LoginModal({ lang, onClose }: { lang: Lang; onClose: () => void }) {
  const t = LABELS[lang]
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [denied, setDenied] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Esc to dismiss. Single window listener — focus trap is overkill here.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    // Auto-focus the email field when the modal mounts.
    inputRef.current?.focus()
    // Lock body scroll while the modal is open.
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (submitting || denied) return
    setSubmitting(true)
    // 600ms feels like a real round-trip without making the user wait. The
    // delay is what sells "we tried — and were turned away" vs "fake button".
    window.setTimeout(() => {
      setSubmitting(false)
      setDenied(true)
    }, 600)
  }

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="login-title">
      <button
        type="button"
        className="modal__backdrop"
        aria-label={t.close}
        onClick={onClose}
        tabIndex={-1}
      />
      <div className="modal__panel">
        <header className="modal__head">
          <h2 id="login-title" className="modal__title">
            {t.title}
          </h2>
          <button
            type="button"
            className="modal__close"
            onClick={onClose}
            aria-label={t.close}
          >
            ×
          </button>
        </header>

        {!denied ? (
          <>
            <p className="modal__intro">{t.intro}</p>
            <form onSubmit={onSubmit} className="login-form">
              <label className="login-form__field">
                <span className="login-form__label mono">{t.emailLabel}</span>
                <input
                  ref={inputRef}
                  type="email"
                  className="login-form__input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t.emailPlaceholder}
                  autoComplete="email"
                  required
                  disabled={submitting}
                />
              </label>
              <div className="login-form__actions">
                <button
                  type="button"
                  className="login-form__cancel"
                  onClick={onClose}
                  disabled={submitting}
                >
                  {t.cancel}
                </button>
                <button type="submit" className="login-form__submit" disabled={submitting}>
                  {submitting ? t.submitting : t.submit}
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="login-denied" role="alert">
            <div className="login-denied__icon" aria-hidden="true">
              ✕
            </div>
            <h3 className="login-denied__title">{t.unauthorizedTitle}</h3>
            <p className="login-denied__body">{t.unauthorizedBody}</p>
            <p className="login-denied__hint mono">{t.unauthorizedHint}</p>
            <button type="button" className="login-denied__close" onClick={onClose}>
              {t.close}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
