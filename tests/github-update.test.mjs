import test from 'node:test';
import assert from 'node:assert/strict';
import {
  checkForGitHubUpdate,
  compareSemver,
  GITHUB_RELEASES_PAGE_URL,
  parseGitHubReleaseResponse,
} from '../src/services/githubUpdateService.ts';

test('compareSemver compares major, minor, patch, v-prefix, and prereleases accurately', () => {
  assert.equal(compareSemver('0.2.4', '0.2.5'), -1);
  assert.equal(compareSemver('v0.2.4', '0.2.4'), 0);
  assert.equal(compareSemver('0.3.0', 'v0.2.9'), 1);
  assert.equal(compareSemver('1.0.0', '0.9.99'), 1);
  assert.equal(compareSemver('0.2.4-beta.1', '0.2.4'), -1);
  assert.equal(compareSemver('0.2.4', '0.2.4-rc.1'), 1);
});

test('parseGitHubReleaseResponse detects update_available with APK asset, up_to_date, and ahead', () => {
  const payload = {
    tag_name: 'v0.2.5',
    name: 'NekoChat v0.2.5',
    html_url: 'https://github.com/JustBadThinker/nekochat/releases/tag/v0.2.5',
    published_at: '2026-11-26T00:00:00Z',
    body: '## Highlights\n- New features',
    assets: [
      {
        name: 'nekochat-v0.2.5.apk',
        browser_download_url: 'https://github.com/JustBadThinker/nekochat/releases/download/v0.2.5/nekochat-v0.2.5.apk',
        size: 42000000,
      },
    ],
  };

  const newer = parseGitHubReleaseResponse(payload, '0.2.4');
  assert.equal(newer.status, 'update_available');
  assert.equal(newer.latestVersion, '0.2.5');
  assert.equal(newer.apkAsset?.name, 'nekochat-v0.2.5.apk');
  assert.match(newer.releaseNotes || '', /Highlights/);

  const same = parseGitHubReleaseResponse(payload, '0.2.5');
  assert.equal(same.status, 'up_to_date');

  const ahead = parseGitHubReleaseResponse(payload, '0.2.6');
  assert.equal(ahead.status, 'ahead');
});

test('checkForGitHubUpdate handles 200, 404, 403, and network errors cleanly', async () => {
  const okRes = await checkForGitHubUpdate('0.2.4', async () =>
    new Response(
      JSON.stringify({
        tag_name: 'v0.2.5',
        html_url: 'https://github.com/JustBadThinker/nekochat/releases/tag/v0.2.5',
        assets: [],
      }),
      { status: 200 }
    )
  );
  assert.equal(okRes.status, 'update_available');
  assert.equal(okRes.latestVersion, '0.2.5');

  const notFoundRes = await checkForGitHubUpdate('0.2.4', async () =>
    new Response('Not Found', { status: 404 })
  );
  assert.equal(notFoundRes.status, 'no_releases');
  assert.equal(notFoundRes.releaseUrl, GITHUB_RELEASES_PAGE_URL);

  const rateLimitedRes = await checkForGitHubUpdate('0.2.4', async () =>
    new Response('Forbidden', { status: 403 })
  );
  assert.equal(rateLimitedRes.status, 'error');
  assert.match(rateLimitedRes.errorMessage || '', /rate limit/i);

  const networkFailRes = await checkForGitHubUpdate('0.2.4', async () => {
    throw new Error('Network down');
  });
  assert.equal(networkFailRes.status, 'error');
  assert.match(networkFailRes.errorMessage || '', /internet connection/i);
});
