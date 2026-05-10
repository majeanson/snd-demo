# Truck Notes — Sunday Night Dread (demo)

Voice-to-invoice MVP for tradespeople. A demo extracted from
[marc-portal](https://github.com/majeanson/marc-portal) and built up over
five revisions:

1. **Rev 01 — barebones**: home page with the name.
2. **Rev 02 — first feature**: voice clip playback + transcript reveal.
3. **Rev 03 — improvements**: parser pulls out client, hours, and materials live.
4. **Rev 04 — final feature**: invoice draft renders inline (Quebec taxes, draft stamp, perforated edge).
5. **Rev 05 — finition**: real-product topbar with brand + Login (decorative magic-link modal returns "Accès refusé"), note→facture timing chip, polished invoice action row, transcript-spacing fix, print stylesheet. ← *current*

Rev 05 is the last revision in this repo. The portal-side integration
(replacing the home page's "Démo principale" with a link to the
`/projects` gallery) lives in `marc-portal`.

Each revision = one push = one Cloudflare Pages deploy = one
`session_advancement` row on the seeded portal session, viewable as a
shareable iframe time-travel.

## Local dev

```sh
npm install
npm run dev
```

## Deploy

Pushes to `main` auto-deploy via the GitHub Actions workflow at
`.github/workflows/deploy.yml`. The first deploy creates the Cloudflare
Pages project `snd-demo` automatically.

Required secrets on the repo:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
