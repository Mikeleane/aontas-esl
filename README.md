# Aontas ESL — Reading Pack route restore (gpt-4.1-mini)

This patch restores a known-good `/api/reading/generate-pack` route.

- Uses OpenAI **Responses API**
- Uses **Structured Outputs** (JSON schema) via `text.format`
- Returns `{ pack }` (what the frontend expects)

## Files included

- `app/api/reading/generate-pack/route.tsx`
- `scripts/patches/overwrite-reading-generate-pack-route.gpt41mini.js`

## Apply it (Option A: unzip)

1) Download the zip and copy it into your repo root:

`C:\Users\mikel\OneDrive\Documents\GitHub\aontas-esl`

2) Unzip (merges folders):

```powershell
Expand-Archive -Force .\aontas-esl-generate-pack-route-gpt41mini.patch.zip .
```

3) Restart dev server:

```powershell
npm run dev
```

## Apply it (Option B: run overwrite script)

If you don't want to unzip, you can copy just the overwrite script into:

`scripts/patches/overwrite-reading-generate-pack-route.gpt41mini.js`

Then run:

```powershell
node .\scripts\patches\overwrite-reading-generate-pack-route.gpt41mini.js
```

The script backs up your current route and writes the fixed one.

## Required env

In `.env.local`:

```bash
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4.1-mini
```

`OPENAI_MODEL` is optional (the route defaults to `gpt-4.1-mini`).

## Quick API test

```powershell
$body = @{
  meta = @{ stage = 3; schoolClass = 3; title = "Rain + Umbrellas" }
  primaryText = "A short text about rain and umbrellas."
  pilotMode = $true
} | ConvertTo-Json -Depth 10

Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/reading/generate-pack `
  -ContentType "application/json" -Body $body | ConvertTo-Json -Depth 6
```


## Emergency switch

If OpenAI ever rejects the strict JSON schema (rare, but it can happen when APIs tighten validation), set:

- `OPENAI_TEXT_FORMAT=json_object`

This disables the schema and just enforces valid JSON.
