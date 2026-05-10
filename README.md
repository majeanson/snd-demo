# Truck Notes — Sunday Night Dread (demo)

Voice-to-invoice MVP for tradespeople. A demo extracted from
[marc-portal](https://github.com/majeanson/marc-portal) and built up over
five revisions:

1. **Rev 01 — barebones**: home page with the name.
2. **Rev 02 — first feature**: voice clip playback + transcript reveal.
3. **Rev 03 — improvements**: parser pulls out client, hours, and materials live.
4. **Rev 04 — final feature**: invoice draft renders inline (Quebec taxes, draft stamp, perforated edge). ← *current*
5. **Rev 05 — final demo**: embedded back into the portal home page.

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
