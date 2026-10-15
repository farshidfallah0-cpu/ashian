import type { InfraEnv } from '@ashian/infra';
import type { SearchEngine } from './types.js';

export * from './alerts.js';
export * from './document.js';
export * from './facets.js';
export * from './filters.js';
export * from './geohash.js';
export * from './indexer.js';
export * from './jobs.js';
export * from './load.js';
export * from './ranking.js';
export * from './service.js';
export * from './types.js';
export { MemoryEngine } from './memory/engine.js';

/**
 * ساخت موتور بر اساس INFRA_MODE.
 * کد برنامه فقط با interface `SearchEngine` کار می‌کند، نه با Typesense یا حافظه.
 */
export async function createSearchEngine(env: InfraEnv): Promise<SearchEngine> {
  if (env.INFRA_MODE === 'lite') {
    const { MemoryEngine } = await import('./memory/engine.js');
    return new MemoryEngine();
  }
  const [{ TypesenseClient }, { TypesenseEngine }] = await Promise.all([
    import('./typesense/client.js'),
    import('./typesense/engine.js'),
  ]);
  return new TypesenseEngine(
    new TypesenseClient({ url: env.TYPESENSE_URL, apiKey: env.TYPESENSE_API_KEY }),
  );
}

export { TypesenseClient } from './typesense/client.js';
export { TypesenseEngine } from './typesense/engine.js';
