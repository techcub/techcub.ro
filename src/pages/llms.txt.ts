import type { APIRoute } from 'astro';
import siteConfig from '@/config/site.config';
import { defaultLocale } from '@/i18n';
import { getPublishedPosts, getPostUrl, getRssUrl } from '@/lib/blog';
import { getVisibleProjects, getProjectUrl } from '@/lib/projects';
import { getNavItems } from '@/config/nav.config';

/**
 * /llms.txt
 *
 * A plain-Markdown map of this site for large language models, following the
 * proposal at https://llmstxt.org. Where robots.txt tells a crawler *whether*
 * it may read the site, llms.txt tells a model *what the site is and which
 * pages matter* — in one short, token-cheap file.
 *
 * Why it's worth having: when someone asks an assistant a question this site
 * could answer, the model has a clean, citable summary instead of guessing
 * from scattered marketing copy.
 *
 * Everything here is generated at build time from `site.config.ts`, the nav
 * config and the content collections, so it describes *your* site and never
 * drifts out of sync with the real pages. There is nothing to keep updated by
 * hand.
 *
 * The page list comes from `getNavItems`, so it follows the public navigation.
 *
 * External nav entries are left out: this file is a map of *this* site, and a
 * link to somewhere else is not part of it.
 *
 * Multi-language sites: the default locale is listed, since llms.txt is meant
 * to stay short. Translated pages remain discoverable through the sitemap and
 * the hreflang tags emitted by the SEO component.
 */

export const GET: APIRoute = async ({ site }) => {
  const base = (site?.toString() || siteConfig.url).replace(/\/$/, '');

  const posts = await getPublishedPosts(defaultLocale);
  const projects = await getVisibleProjects(defaultLocale);

  const line = (title: string, url: string, description?: string) =>
    description ? `- [${title}](${url}): ${description}` : `- [${title}](${url})`;

  const postLines = [...posts]
    .sort((a, b) => b.data.publishedAt.valueOf() - a.data.publishedAt.valueOf())
    .map((post) => line(post.data.title, `${base}${getPostUrl(post.id, defaultLocale)}`, post.data.description))
    .join('\n');

  const projectLines = [...projects]
    .sort((a, b) => a.data.order - b.data.order)
    .map((project) =>
      line(project.data.title, `${base}${getProjectUrl(project.id, defaultLocale)}`, project.data.description)
    )
    .join('\n');

  const pageLines = getNavItems(defaultLocale)
    .filter((item) => !item.external)
    .map((item) => line(item.label, `${base}${item.href}`));

  const sections = [
    `# ${siteConfig.name}`,
    ``,
    `> ${siteConfig.description}`,
    ``,
    `## Pages`,
    ``,
    ...pageLines,
  ];

  if (projectLines) {
    sections.push(``, `## Projects`, ``, projectLines);
  }

  if (postLines) {
    sections.push(``, `## Blog posts`, ``, postLines);
  }

  sections.push(
    ``,
    `## More`,
    ``,
    line('Sitemap', `${base}/sitemap-index.xml`),
    line('RSS feed', `${base}${getRssUrl(defaultLocale)}`),
    ``,
    `---`,
    ``,
    `Contact: ${siteConfig.email}`,
    ``
  );

  return new Response(sections.join('\n'), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
};
