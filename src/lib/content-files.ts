const files = import.meta.glob('/src/content/{blog,pages,projects}/**/*.{md,mdx}');

export function hasContent(collection: 'blog' | 'pages' | 'projects'): boolean {
  return Object.keys(files).some((path) => path.startsWith(`/src/content/${collection}/`));
}
