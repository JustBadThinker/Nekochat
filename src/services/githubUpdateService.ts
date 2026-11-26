/**
 * NekoChat — GitHub Releases Update Checker
 * Zero React Native dependencies so it is directly unit-testable in Node.
 */

export const GITHUB_REPO = 'JustBadThinker/nekochat';
export const GITHUB_REPO_URL = `https://github.com/${GITHUB_REPO}`;
export const GITHUB_RELEASES_API_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
export const GITHUB_RELEASES_PAGE_URL = `${GITHUB_REPO_URL}/releases`;

export interface GitHubReleaseAsset {
  name: string;
  downloadUrl: string;
  sizeBytes: number;
}

export interface UpdateCheckResult {
  status: 'update_available' | 'up_to_date' | 'ahead' | 'no_releases' | 'error';
  currentVersion: string;
  latestVersion?: string;
  releaseName?: string;
  releaseNotes?: string;
  releaseUrl: string;
  publishedAt?: string;
  apkAsset?: GitHubReleaseAsset | null;
  errorMessage?: string;
}

function parseSemverParts(raw: string): { nums: [number, number, number]; prerelease: string } {
  const clean = String(raw || '')
    .trim()
    .replace(/^v/i, '');
  const [basePart = '0.0.0', ...preParts] = clean.split('-');
  const segments = basePart.split('.').map(seg => {
    const match = seg.match(/^\d+/);
    return match ? Number(match[0]) : 0;
  });
  return {
    nums: [segments[0] || 0, segments[1] || 0, segments[2] || 0],
    prerelease: preParts.join('-').trim(),
  };
}

/**
 * Compares two semver strings:
 * returns -1 if current < latest, 0 if equal, 1 if current > latest.
 */
export function compareSemver(current: string, latest: string): number {
  const a = parseSemverParts(current);
  const b = parseSemverParts(latest);

  for (let i = 0; i < 3; i++) {
    if (a.nums[i] < b.nums[i]) return -1;
    if (a.nums[i] > b.nums[i]) return 1;
  }

  if (a.prerelease && !b.prerelease) return -1;
  if (!a.prerelease && b.prerelease) return 1;
  if (a.prerelease && b.prerelease) {
    if (a.prerelease < b.prerelease) return -1;
    if (a.prerelease > b.prerelease) return 1;
  }
  return 0;
}

export function parseGitHubReleaseResponse(
  data: any,
  currentVersion: string
): UpdateCheckResult {
  const cleanCurrent = String(currentVersion || '0.0.0').replace(/^v/i, '').trim();
  const latestVersion = String(data?.tag_name || data?.name || '')
    .replace(/^v/i, '')
    .trim();

  const releaseUrl =
    typeof data?.html_url === 'string' && data.html_url.startsWith('https://')
      ? data.html_url
      : GITHUB_RELEASES_PAGE_URL;

  if (!latestVersion) {
    return {
      status: 'error',
      currentVersion: cleanCurrent,
      releaseUrl,
      errorMessage: 'Release metadata is missing a version tag.',
    };
  }

  const assets: any[] = Array.isArray(data?.assets) ? data.assets : [];
  const rawApk = assets.find(
    a =>
      typeof a?.name === 'string' &&
      a.name.toLowerCase().endsWith('.apk') &&
      typeof a?.browser_download_url === 'string' &&
      a.browser_download_url.startsWith('https://')
  );
  const apkAsset: GitHubReleaseAsset | null = rawApk
    ? {
        name: rawApk.name,
        downloadUrl: rawApk.browser_download_url,
        sizeBytes: Number(rawApk.size) || 0,
      }
    : null;

  const cmp = compareSemver(cleanCurrent, latestVersion);
  const status: UpdateCheckResult['status'] =
    cmp < 0 ? 'update_available' : cmp === 0 ? 'up_to_date' : 'ahead';

  const rawBody = typeof data?.body === 'string' ? data.body.trim() : '';
  const releaseNotes = rawBody
    ? rawBody.replace(/#{1,6}\s*/g, '').replace(/\r\n/g, '\n').trim()
    : undefined;

  return {
    status,
    currentVersion: cleanCurrent,
    latestVersion,
    releaseName: typeof data?.name === 'string' ? data.name.trim() : undefined,
    releaseNotes,
    releaseUrl,
    publishedAt: typeof data?.published_at === 'string' ? data.published_at : undefined,
    apkAsset,
  };
}

export async function checkForGitHubUpdate(
  currentVersion: string,
  fetchImpl: typeof fetch = fetch
): Promise<UpdateCheckResult> {
  const cleanCurrent = String(currentVersion || '0.0.0').replace(/^v/i, '').trim();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 9000);

  try {
    const res = await fetchImpl(GITHUB_RELEASES_API_URL, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (res.status === 404) {
      return {
        status: 'no_releases',
        currentVersion: cleanCurrent,
        releaseUrl: GITHUB_RELEASES_PAGE_URL,
        errorMessage: 'No published GitHub releases yet.',
      };
    }

    if (res.status === 403) {
      return {
        status: 'error',
        currentVersion: cleanCurrent,
        releaseUrl: GITHUB_RELEASES_PAGE_URL,
        errorMessage: 'GitHub API rate limit reached. Open Releases directly.',
      };
    }

    if (!res.ok) {
      return {
        status: 'error',
        currentVersion: cleanCurrent,
        releaseUrl: GITHUB_RELEASES_PAGE_URL,
        errorMessage: `GitHub returned HTTP ${res.status}. Try again or open Releases.`,
      };
    }

    const data = await res.json();
    return parseGitHubReleaseResponse(data, cleanCurrent);
  } catch {
    return {
      status: 'error',
      currentVersion: cleanCurrent,
      releaseUrl: GITHUB_RELEASES_PAGE_URL,
      errorMessage: 'Could not reach GitHub. Check your internet connection.',
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
