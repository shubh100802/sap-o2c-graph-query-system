# Submission Checklist

## Local Verification

- [ ] `npm run setup`
- [ ] `npm start`
- [ ] Open `http://localhost:3000`
- [ ] Run required example queries in chat

## Required Artifacts

- [ ] Public GitHub repository URL
- [ ] Working demo link (local-hosted or deployed)
- [ ] README with architecture, DB choice, prompting, guardrails
- [ ] AI coding session logs (see `AI_CODING_LOGS/`)

## Suggested Deployment

- Backend + static frontend can be hosted as a single Node service.
- Ensure env vars are set on hosting platform:
  - `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
  - `LLM_PROVIDER`, `GROQ_API_KEY` or `GEMINI_API_KEY`
