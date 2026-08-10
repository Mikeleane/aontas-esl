# Aontas ESL

Aontas ESL is a teacher-facing English language learning platform built around the CEFR A1-C2 framework.

The application generates and adapts learning material through a shared set of canonical contracts. The principal workflows are Reading, Exercises, Social Thread, Wordiness and H5P activities.

## Development

Install dependencies and start the local development server:

    npm install
    npm run dev

Run the full local quality checks with:

    npm run typecheck
    npm run lint:strict
    npm run test
    npm run build

`lint:strict` must complete with zero errors and zero warnings.

## Architecture

CEFR definitions live in `lib/cefr.ts`.

Canonical generation contracts live under `lib/contracts/` and use lowercase `standard` and `supported` variants.

The principal application routes are:

- `/pack` - Reading
- `/exercises` - Exercises
- `/social` - Social Thread
- `/wordiness` - Wordiness activity suite
- `/h5p` - H5P activities

Historical output aliases and school-stage data are handled only at explicit compatibility boundaries.

## Wordiness

The Wordiness suite is stored in `public/wordiness/` and contains the expanded activity library migrated from the KNS implementation.

Reading Packs can seed Wordiness activities using the shared CEFR-aware Standard/Supported seed contract.

## H5P

The H5P Word Order generator uses the canonical DragText template at:

`public/h5p/_templates/dragtext`

Only the dependency closure required by DragText is retained in the repository.

Generated Reading Pack H5P instances are runtime artifacts and are ignored by Git.

## Environment

Local secrets belong in `.env.local`.

Do not commit API keys or other credentials to the repository.

## Verification

Regression suites under `scripts/verify-phase*.cjs` protect the CEFR spine, generation contracts, Wordiness bridge, H5P behavior and compatibility boundaries.

A production-ready change should pass TypeScript, strict ESLint, all regression suites and the Next.js production build.
