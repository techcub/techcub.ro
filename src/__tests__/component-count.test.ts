import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import registry from '../../component-registry.json';
import siteConfig from '../config/site.config';
import { businessConfig } from '../config/business.config';

describe('component registry', () => {
  it('lists files that exist', () => {
    for (const [name, entry] of Object.entries(registry.components)) {
      for (const file of entry.files) {
        expect(() => readFileSync(join(process.cwd(), file)), `${name} -> ${file}`).not.toThrow();
      }
    }
  });

  it('contains no duplicate component files', () => {
    const files = Object.values(registry.components).flatMap((entry) => entry.files);
    expect(new Set(files).size).toBe(files.length);
  });

  it('uses the central business identity', () => {
    expect(siteConfig.name).toBe(businessConfig.brandName);
    expect(siteConfig.description).toBe(businessConfig.description);
  });
});
