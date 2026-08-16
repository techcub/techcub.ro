# Working in this codebase

This repository contains the production website for Tech cu Bogdan.

## Project structure

```
src/config/      Business, navigation, language and consent settings
src/content/     Blog and project content
src/i18n/        Romanian and English interface copy
src/components/  Reusable site components
src/pages/       File-based routes
src/layouts/     Shared page layouts
src/lib/         Content, SEO and integration helpers
src/styles/      Design tokens and the violet theme
```

Read `component-registry.json` before adding a new component. Reuse existing components and design tokens.

Business identity belongs in `src/config/business.config.ts`. User-facing copy belongs in both `src/i18n/ro.json` and `src/i18n/en.json`.

Keep the site dark-only and violet. Do not add theme or colour selectors.

New motion must respect `prefers-reduced-motion`. Images must use `astro:assets`.

## Commands

```bash
pnpm dev
pnpm lint
pnpm check
pnpm test:run
pnpm build
pnpm verify
```

Run lint, check, tests and a production build before publishing.
