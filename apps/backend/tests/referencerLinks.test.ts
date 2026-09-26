import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkSourceUrl } from '../src/agents/referencer/referencer.fetch.js';
import { reachableOptions } from '../src/agents/referencer/referencer.links.js';
import { fetchReferenceText, suggestReferences } from '../src/agents/referencer/referencer.agent.js';
import type { ReferenceOption } from '../src/agents/referencer/referencer.types.js';
import { LLMClient } from '../src/llm/index.js';
import * as config from '../src/config/index.js';

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); });

const option = (url: string): ReferenceOption => ({
  id: url, url, title: 'Biology', source: 'OpenStax', kind: 'book',
  summary: '', whyRelevant: '', verified: true, trust: 'high',
});

describe('reference link availability', () => {
  it('falls back to the real search URL when the model invents a missing path', async () => {
    vi.spyOn(config, 'llmAvailable').mockReturnValue(true);
    vi.spyOn(LLMClient.prototype, 'grounded').mockResolvedValue({
      text: 'Biology textbook', sources: [{ title: 'OpenStax', uri: 'https://openstax.org/subjects' }],
      retrieved: [],
    });
    vi.spyOn(LLMClient.prototype, 'structured').mockResolvedValue({
      options: [option('https://openstax.org/invented')],
    });
    vi.stubGlobal('fetch', vi.fn(async (url: string) =>
      new Response(null, { status: url.endsWith('/invented') ? 404 : 200 })));
    const result = await suggestReferences({ topic: 'Biology', count: 1 });
    expect(result.source).toBe('search');
    expect(result.options.map(item => item.url)).toEqual(['https://openstax.org/subjects']);
  });

  it('removes a 404 even when its publisher was verified by search', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) =>
      new Response('', { status: url.endsWith('/missing') ? 404 : 200 })));
    const live = option('https://openstax.org/subjects');
    expect(await reachableOptions([option('https://openstax.org/missing'), live])).toEqual([live]);
  });

  it('uses GET, cancels the body, and returns the final redirect destination', async () => {
    const response = new Response('PDF content');
    const cancel = vi.spyOn(response.body!, 'cancel');
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 301, headers: { location: '/new' } }))
      .mockResolvedValueOnce(response);
    vi.stubGlobal('fetch', fetcher);
    expect(await checkSourceUrl('https://openstax.org/old')).toBe('https://openstax.org/new');
    expect(fetcher.mock.calls[0][1].method).toBeUndefined(); // fetch defaults to GET
    expect(cancel).toHaveBeenCalledOnce();
  });

  it('drops dead redirect targets and bounds redirect loops', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: '/gone' } }))
      .mockResolvedValueOnce(new Response(null, { status: 410 }));
    vi.stubGlobal('fetch', fetcher);
    expect(await checkSourceUrl('https://openstax.org/old')).toBeNull();
    fetcher.mockImplementation(async () => new Response(null, { status: 302, headers: { location: '/loop' } }));
    expect(await checkSourceUrl('https://openstax.org/loop')).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(8);
  });

  it('never follows a redirect to a private address', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, {
      status: 302, headers: { location: 'http://127.0.0.1/admin' },
    }));
    vi.stubGlobal('fetch', fetcher);
    expect(await checkSourceUrl('https://openstax.org/old')).toBeNull();
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('reapplies publisher policy and deduplicates redirected pages', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => url.includes('/old')
      ? new Response(null, { status: 302, headers: { location: '/new' } })
      : new Response(null, { status: 200 })));
    const results = await reachableOptions([
      option('https://openstax.org/old'), option('https://openstax.org/new'),
      option('https://en.wikipedia.org/wiki/Biology'),
    ]);
    expect(results.map(item => item.url)).toEqual(['https://openstax.org/new']);
  });

  it('handles network errors and timeouts without exposing broken links', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    expect(await checkSourceUrl('https://openstax.org/subjects')).toBeNull();
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn((_url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(new Error('timeout')));
    })));
    const pending = checkSourceUrl('https://openstax.org/subjects');
    await vi.advanceTimersByTimeAsync(8_000);
    expect(await pending).toBeNull();
  });

  it('checks fallback links when no AI credential is configured', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 404 })));
    expect((await suggestReferences({ topic: 'Biology' })).options).toEqual([]);
  });

  it('refuses to adopt a formerly valid link that now returns 404', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 404 })));
    const result = await fetchReferenceText('https://openstax.org/removed', 'Biology');
    expect(result.ok).toBe(false);
    expect(result.text).toBe('');
    expect(result.problem).toContain('no longer available');
  });
});
