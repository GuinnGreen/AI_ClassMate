export interface ReleaseManifestInput {
  appCommit: string;
  guideCommit: string;
  rulesHash: string;
  builtAt: string;
}

export interface ReleaseManifest {
  releaseId: string;
  buildTime: string;
  schemaCompatibility: number[];
  components: {
    app: { commit: string; deployedByThisRelease: true };
    guide: { commit: string; deployedByThisRelease: true };
    functions: { sourceCommit: string; deployment: 'external' };
    rules: { sourceHash: string; deployment: 'external' };
  };
}

const SHA_PATTERN = /^[0-9a-f]{40}$/;
const HASH_PATTERN = /^[0-9a-f]{64}$/;
const UTC_SECONDS_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

function isCanonicalUtcSeconds(timestamp: string): boolean {
  if (!UTC_SECONDS_PATTERN.test(timestamp)) return false;

  const date = new Date(timestamp);
  return !Number.isNaN(date.getTime()) && date.toISOString() === `${timestamp.slice(0, -1)}.000Z`;
}

export function createReleaseManifest(input: ReleaseManifestInput): ReleaseManifest {
  if (!SHA_PATTERN.test(input.appCommit)) throw new Error('appCommit must be a 40-character Git SHA');
  if (!SHA_PATTERN.test(input.guideCommit)) throw new Error('guideCommit must be a 40-character Git SHA');
  if (!HASH_PATTERN.test(input.rulesHash)) throw new Error('rulesHash must be a SHA-256 digest');
  if (!isCanonicalUtcSeconds(input.builtAt)) throw new Error('builtAt must be ISO-8601');

  const compactTime = input.builtAt.replaceAll('-', '').replaceAll(':', '').replace('.000', '');
  return {
    releaseId: `${input.appCommit.slice(0, 12)}-${input.guideCommit.slice(0, 12)}-${compactTime}`,
    buildTime: input.builtAt,
    schemaCompatibility: [1],
    components: {
      app: { commit: input.appCommit, deployedByThisRelease: true },
      guide: { commit: input.guideCommit, deployedByThisRelease: true },
      functions: { sourceCommit: input.appCommit, deployment: 'external' },
      rules: { sourceHash: input.rulesHash, deployment: 'external' },
    },
  };
}
