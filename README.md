# Sheet Image Lookup

A small static site served by a Cloudflare Worker. The Worker uses a
Google service account to read the configured Google Sheet; the credential
stays in a Cloudflare secret and is never sent to the browser.

Live site: <https://sheet-image-lookup.quan-tm1103.workers.dev/>

## Requirements

- Node.js 22 or later and npm
- A Cloudflare account
- The service-account JSON file in the project root
- The Google Sheets API enabled for the service account's Google Cloud project

The configured spreadsheet is `1iXp8DSMCMPLNetwaKVFvJHewNphHkwI3CC654hEKgNM`,
and its tab is `Trang tính1`. Share the spreadsheet with the `client_email`
from the service-account JSON and grant Viewer access.

## Deploy from PowerShell

Run these commands in the project folder:

```powershell
npm install
npx wrangler login
Get-Content -Raw .\sheet-db-511904-c386b5ac8b09.json | npx wrangler secret put GOOGLE_SERVICE_ACCOUNT_JSON
npm run deploy
```

`wrangler login` opens a Cloudflare authorization page; complete the login in
your browser and return to the terminal. The secret command sends the local
service-account JSON to Cloudflare without printing it. Never paste the JSON
into chat, commit it, or place it in browser config.

After deployment, Wrangler prints a `workers.dev` URL. Open it to use the
lookup page. The spreadsheet ID and tab are configured in `wrangler.jsonc`;
change them there if needed, then deploy again.

## Local development

Create `.dev.vars` from the local service-account file without printing the
credential:

```powershell
$serviceAccount = Get-Content -Raw .\sheet-db-511904-c386b5ac8b09.json | ConvertFrom-Json | ConvertTo-Json -Compress
[System.IO.File]::WriteAllText((Join-Path $PWD ".dev.vars"), "GOOGLE_SERVICE_ACCOUNT_JSON=$serviceAccount")
npm run dev
```

Keep `.dev.vars` private; it is excluded by `.gitignore`. Open the local URL
printed by Wrangler and stop the server with Ctrl+C.

## Access and privacy

The spreadsheet does not need public sharing. The Worker returns only the
picture URL matching the submitted key, but the `/api/lookup` endpoint is
internet-accessible after deployment. Anyone can submit keys to it, so use
unguessable keys and only expose data that is appropriate for the intended
audience. Add an authentication layer if lookups must be restricted to signed-in
users.
