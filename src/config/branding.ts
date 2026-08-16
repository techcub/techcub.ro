/**
 * Brand values needed before `astro:env` exists.
 *
 * `astro.config.mjs` generates the favicon PNG/ICO files in a build hook and
 * needs the site's initial and its theme colour to do it — but it cannot
 * import `site.config.ts`, which reads `astro:env/server` and so cannot be
 * loaded at config time. Same constraint as `site-url.ts`, same answer: keep
 * the values in a plain module both sides import, so they cannot drift.
 *
 * Change them here. `site.config.ts` reads from this file.
 */
import { businessConfig } from './business.config';

export const SITE_NAME = businessConfig.brandName;

/** Browser toolbar colour, and the fill behind the favicon letter. */
export const THEME_COLOR = '#6657ff';
