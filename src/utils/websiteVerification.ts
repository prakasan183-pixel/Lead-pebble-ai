import type { WebsiteStatus } from './leadScoring.ts';

export interface WebsiteVerificationResult {
  websiteStatus: WebsiteStatus;
  websiteUrl: string | null;
  httpStatus?: number;
  notes: string;
  verifiedAt: string;
  sourceUrl?: string;
  candidateUrl?: string;
  method: 'identity_verified' | 'automated_probe' | 'search_grounding';
}

type WebsiteFetcher = typeof fetch;

const REQUEST_TIMEOUT_MS = 3500;
const MAX_RESPONSE_BYTES = 64 * 1024;

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

export function normalizeWebsiteUrl(value: string): URL | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const candidate = /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const url = new URL(candidate);
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) return null;
    url.hash = '';
    url.search = '';
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, '');
    return url;
  } catch {
    return null;
  }
}

function responseMatchesCompany(companyName: string, html: string): boolean {
  const normalizedCompany = normalizeText(companyName);
  const meaningfulTokens = normalizedCompany
    .split(' ')
    .filter((token) => token.length > 2 && !/^(the|and|for|inc|llc|ltd|limited|company|corp|corporation|industries|industrial|manufacturing|services|group)$/.test(token));
  const normalizedHtml = normalizeText(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' '));

  if (normalizedHtml.includes(normalizedCompany)) return true;
  if (!meaningfulTokens.length) return false;
  const matches = meaningfulTokens.filter((token) => normalizedHtml.includes(token));
  return matches.length >= Math.min(2, meaningfulTokens.length);
}

async function readLimitedBody(response: Response): Promise<string> {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (totalBytes < MAX_RESPONSE_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = value.subarray(0, MAX_RESPONSE_BYTES - totalBytes);
      chunks.push(chunk);
      totalBytes += chunk.length;
      if (chunk.length < value.length) break;
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder().decode(bytes);
}

function result(
  websiteStatus: WebsiteStatus,
  websiteUrl: string | null,
  notes: string,
  httpStatus?: number,
  sourceUrl?: string,
  method: WebsiteVerificationResult['method'] = 'automated_probe'
): WebsiteVerificationResult {
  return {
    websiteStatus,
    websiteUrl,
    notes,
    httpStatus,
    sourceUrl,
    method,
    verifiedAt: new Date().toISOString(),
  };
}

export async function verifyWebsiteUrl(
  companyName: string,
  rawUrl: string,
  fetcher: WebsiteFetcher = fetch
): Promise<WebsiteVerificationResult> {
  const normalized = normalizeWebsiteUrl(rawUrl);
  if (!normalized) {
    return result('could_not_verify', null, 'The supplied website address is invalid; ownership could not be verified.');
  }

  const protocols = normalized.protocol === 'https:' ? ['https:', 'http:'] : ['http:', 'https:'];
  let lastStatus: number | undefined;
  let sawResponsiveHost = false;

  for (const protocol of protocols) {
    const candidate = new URL(normalized.href);
    candidate.protocol = protocol;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        const response = await fetcher(candidate.href, {
          method: 'GET',
          redirect: 'follow',
          signal: controller.signal,
          headers: {
            'User-Agent': 'LeadPebble-Website-Verification/1.0',
            Range: `bytes=0-${MAX_RESPONSE_BYTES - 1}`,
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
        });
        lastStatus = response.status;
        sawResponsiveHost = true;

        if (response.status === 401 || response.status === 403 || response.status === 429 || response.status >= 500) {
          continue;
        }
        if (!response.ok) continue;

        const resolved = normalizeWebsiteUrl(response.url || candidate.href) || candidate;
        const contentType = response.headers.get('content-type') || '';
        if (!/text\/html|application\/xhtml\+xml/i.test(contentType)) {
          return result(
            'could_not_verify',
            null,
            `The URL responded with HTTP ${response.status}, but did not return an HTML company website.`,
            response.status,
            resolved.href
          );
        }
        const html = await readLimitedBody(response);
        if (responseMatchesCompany(companyName, html)) {
          return result(
            'active_website',
            resolved.href,
            `Website responded with HTTP ${response.status}; company identity matched its page content or domain.`,
            response.status,
            resolved.href,
            'identity_verified'
          );
        }

        const looksClientRendered = /<div[^>]+id=["'](?:root|app)["'][^>]*>\s*<\/div>|enable javascript|javascript is required/i.test(html);
        return result(
          'could_not_verify',
          null,
          looksClientRendered
            ? `The site responded with HTTP ${response.status}, but its JavaScript-rendered content could not be checked.`
            : `The site responded with HTTP ${response.status}, but its content did not verify that it belongs to ${companyName}.`,
          response.status,
          resolved.href
        );
      } catch {
        // Retry transient network and timeout errors on both HTTPS and HTTP.
      } finally {
        clearTimeout(timeout);
      }
    }
  }

  return result(
    'could_not_verify',
    null,
    sawResponsiveHost
      ? `The website is blocked, unavailable, or returned HTTP ${lastStatus}; this does not establish that the company has no website.`
      : 'The website did not respond after HTTPS/HTTP retries; temporary network or DNS failures are not treated as proof that no website exists.',
    lastStatus
  );
}

export function classifySearchWebsiteFinding(
  searchText: string,
  sourceUrl?: string
): WebsiteVerificationResult {
  if (sourceUrl && /NO_OFFICIAL_SITE_FOUND/i.test(searchText)) {
    return result(
      'no_website_verified',
      null,
      'No official company website was found in cited search results; this is a search finding, not proof that no site exists.',
      undefined,
      sourceUrl,
      'search_grounding'
    );
  }
  return result(
    'could_not_verify',
    null,
    'Search results did not provide enough evidence to confirm an official company website or its absence.',
    undefined,
    sourceUrl,
    'search_grounding'
  );
}
