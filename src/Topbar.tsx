import type { Lang } from './VoiceMemo'

interface TopbarLabels {
  brandName: string
  brandTagline: string
  langSwitch: string
  login: string
}

const LABELS: Record<Lang, TopbarLabels> = {
  fr: {
    brandName: 'Truck Notes',
    brandTagline: 'Notes → factures',
    langSwitch: 'EN',
    login: 'Connexion',
  },
  en: {
    brandName: 'Truck Notes',
    brandTagline: 'Notes → invoices',
    langSwitch: 'FR',
    login: 'Sign in',
  },
}

/**
 * Real-product-looking header. Brand wordmark on the left, lang toggle and
 * a (decorative) Pricing link + Login button on the right. Login click is
 * lifted to the parent so it can mount the modal.
 */
export function Topbar({
  lang,
  onLangSwitch,
  onLoginClick,
}: {
  lang: Lang
  onLangSwitch: () => void
  onLoginClick: () => void
}) {
  const t = LABELS[lang]
  return (
    <header className="topbar" role="banner">
      <a className="brand" href="#main">
        <span className="brand__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
            {/* Stylized speech bubble with a play triangle inside */}
            <path
              d="M3 5h18v11H8l-5 4V5z"
              fill="currentColor"
              fillOpacity="0.16"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
            <path d="M10 9.5v5l4-2.5z" fill="currentColor" />
          </svg>
        </span>
        <span className="brand__text">
          <span className="brand__name">{t.brandName}</span>
          <span className="brand__tagline mono">{t.brandTagline}</span>
        </span>
      </a>

      <nav className="topnav" aria-label="primary">
        <button
          type="button"
          className="topnav__lang mono"
          onClick={onLangSwitch}
          aria-label={t.langSwitch}
        >
          {t.langSwitch}
        </button>
        <button type="button" className="topnav__login" onClick={onLoginClick}>
          {t.login}
        </button>
      </nav>
    </header>
  )
}
