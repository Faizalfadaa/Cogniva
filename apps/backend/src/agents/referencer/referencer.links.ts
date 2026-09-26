import { checkSourceUrl } from './referencer.fetch.js';
import { hostOf } from './referencer.guard.js';
import { byTrust, isBlockedHost, meetsMinTrust, trustOfHost } from './referencer.trust.js';
import type { ReferenceOption } from './referencer.types.js';

/** Keep only live pages, preserving their final URL after redirects. */
export async function reachableOptions(options: ReferenceOption[]): Promise<ReferenceOption[]> {
  const checked = await Promise.all(options.map(async (option) => {
    const url = await checkSourceUrl(option.url);
    if (!url) return null;
    const host = hostOf(url);
    const trust = trustOfHost(host);
    // A trusted search redirect must not bypass the publisher policy.
    if (isBlockedHost(host) || !meetsMinTrust(trust)) return null;
    return { ...option, url, trust };
  }));
  const seen = new Set<string>();
  return checked.filter((option): option is ReferenceOption => {
    if (!option) return false;
    const key = new URL(option.url);
    key.hash = '';
    if (seen.has(key.href)) return false;
    seen.add(key.href);
    return true;
  }).sort(byTrust);
}
