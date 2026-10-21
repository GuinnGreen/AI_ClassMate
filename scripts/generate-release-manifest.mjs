import { mkdir, writeFile } from 'node:fs/promises';
import { createReleaseManifest } from './releaseManifest.ts';

const manifest = createReleaseManifest({
  appCommit: process.env.APP_COMMIT ?? '',
  guideCommit: process.env.GUIDE_COMMIT ?? '',
  rulesHash: process.env.RULES_HASH ?? '',
  builtAt: process.env.BUILD_TIME ?? '',
});

await mkdir('public', { recursive: true });
await writeFile('public/version.json', `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
