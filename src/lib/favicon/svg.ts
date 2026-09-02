export function buildFaviconSvg(
  logoMark: string,
  bgColor: string,
  fgColor = '#ffffff',
  size = 48
): string {
  const viewBox = logoMark.match(/viewBox="([^"]+)"/)?.[1];
  const content = logoMark.match(/<svg[^>]*>([\s\S]*)<\/svg>/)?.[1];

  if (!viewBox || !content) {
    throw new Error('[favicon] The logo mark must be a valid SVG with a viewBox.');
  }

  const [, , width, height] = viewBox.split(/\s+/).map(Number);
  const inset = size * 0.12;
  const scale = (size - inset * 2) / Math.max(width, height);
  const x = (size - width * scale) / 2;
  const y = (size - height * scale) / 2;
  const mark = content.replaceAll('currentColor', fgColor);

  return [
    `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">`,
    `<rect width="${size}" height="${size}" rx="${(size / 6).toFixed(2)}" fill="${bgColor}"/>`,
    `<g transform="translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${scale})">${mark}</g>`,
    '</svg>',
  ].join('');
}
