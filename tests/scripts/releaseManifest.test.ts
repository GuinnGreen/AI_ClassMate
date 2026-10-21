import { describe, expect, it } from 'vitest';
import { createReleaseManifest } from '../../scripts/releaseManifest';

describe('createReleaseManifest', () => {
  const input = {
    appCommit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    guideCommit: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    rulesHash: 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
    builtAt: '2026-08-29T12:00:00Z',
  };

  it('creates a deterministic component manifest', () => {
    expect(createReleaseManifest(input)).toEqual({
      releaseId: 'aaaaaaaaaaaa-bbbbbbbbbbbb-20260829T120000Z',
      buildTime: '2026-08-29T12:00:00Z',
      schemaCompatibility: [1],
      components: {
        app: { commit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', deployedByThisRelease: true },
        guide: { commit: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', deployedByThisRelease: true },
        functions: { sourceCommit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', deployment: 'external' },
        rules: { sourceHash: 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc', deployment: 'external' },
      },
    });
  });

  it('rejects a malformed app commit', () => {
    expect(() => createReleaseManifest({ ...input, appCommit: 'main' }))
      .toThrow('appCommit must be a 40-character Git SHA');
  });

  it('rejects a malformed guide commit', () => {
    expect(() => createReleaseManifest({ ...input, guideCommit: 'guide' }))
      .toThrow('guideCommit must be a 40-character Git SHA');
  });

  it('rejects a malformed rules hash', () => {
    expect(() => createReleaseManifest({ ...input, rulesHash: 'rules' }))
      .toThrow('rulesHash must be a SHA-256 digest');
  });

  it('rejects an invalid build timestamp', () => {
    expect(() => createReleaseManifest({ ...input, builtAt: 'not-a-date' }))
      .toThrow('builtAt must be ISO-8601');
  });

  it.each([
    '2026-08-29',
    '2026-08-29T20:00:00+08:00',
    '2026-08-29T12:00:00.000Z',
    '2026-02-30T12:00:00Z',
  ])('rejects a non-canonical UTC-seconds timestamp: %s', (builtAt) => {
    expect(() => createReleaseManifest({ ...input, builtAt }))
      .toThrow('builtAt must be ISO-8601');
  });

  it('uses an accepted build timestamp verbatim in the deterministic release ID', () => {
    expect(createReleaseManifest({ ...input, builtAt: '2026-12-31T23:59:58Z' }).releaseId)
      .toBe('aaaaaaaaaaaa-bbbbbbbbbbbb-20261231T235958Z');
  });
});
