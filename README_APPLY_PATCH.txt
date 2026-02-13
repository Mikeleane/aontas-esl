Aontas ESL – Fix reading generate-pack route

1) Copy these folders into your repo root (merge):
   - app/
   - scripts/

2) From repo root, run:
   node .\scripts\patches\overwrite-reading-generate-pack-route.gpt41mini.js

3) Ensure your .env.local has:
   OPENAI_API_KEY=...your key...
   OPENAI_MODEL=gpt-4.1-mini

4) Restart dev server:
   Ctrl+C
   npm run dev

If you still get 400 "Missing input text", paste the JSON request body from DevTools > Network > generate-pack > Payload.
