import { BRAND_NAME, DEFAULT_OG_IMAGE, SITE_URL } from './brand';

export interface SeoInput {
  title: string;
  description: string;
  path: string;
  ogImage?: string;
  titleTemplate?: boolean;
}

export function buildSeo({ title, description, path, ogImage, titleTemplate = true }: SeoInput) {
  const canonical = new URL(path, SITE_URL).toString();
  const imageUrl = new URL(ogImage || DEFAULT_OG_IMAGE, SITE_URL).toString();

  return {
    title: titleTemplate ? `${title} · ${BRAND_NAME}` : title,
    description,
    canonical,
    ogImage: imageUrl,
  };
}
