# Peak Release Routing

## Canonical Backend

Use this backend for the new Peak release path:

```text
https://supermax.kr/peak
https://supermax.kr/peak-health
https://supermax.kr/socket.io/
```

Browser code must read the fixed constants in `src/lib/api/base-url.ts`.
Do not add public Vercel API fallback variables such as
`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_FALLBACK_API_URL`, or
`NEXT_PUBLIC_SOCKET_URL`.

## Legacy Bridge

`chejump.com` is a legacy compatibility bridge only. It must not be used as a
new frontend, backend, smoke, CORS, CSP, or Vercel env default.

Before removing the bridge, collect sanitized access and callback proof through
the PACA/Peak platform map runbooks.

## Required Checks

```bash
npx jest --runTestsByPath __tests__/unit/frontend/release-routing-contract.test.ts --runInBand
npx jest --runTestsByPath __tests__/unit/backend/env.test.js --runInBand
npm run build
```

After an approved production deploy, refresh live proof from
`/Users/etlab/projects/paca-peak-platform-map`:

```bash
python3 scripts/live_js_evidence_writer.py
python3 scripts/live_js_evidence_audit.py
python3 scripts/csp_header_evidence_writer.py
python3 scripts/csp_header_evidence_audit.py
```
