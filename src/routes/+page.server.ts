/**
 * Home Page - Server Load
 * Fetch manga list by source / search / page.
 * Cache pendek agar ganti source tidak nempel data lama.
 */

import { getAllSources, getSource } from '$lib/server/sources';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, setHeaders, depends }) => {
	const sourceId = url.searchParams.get('source') || 'asura';
	const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
	const query = (url.searchParams.get('q') || '').trim();

	// Biar invalidate('browse') dari client ikut ke-trigger
	depends(`browse:${sourceId}`);

	try {
		const adapter = getSource(sourceId);
		const sources = getAllSources();

		const mangas = query
			? await adapter.searchManga(query)
			: await adapter.getLatestManga(page);

		setHeaders({
			// Jangan cache agresif di browser — ganti source harus fresh
			'Cache-Control': 'private, no-cache, max-age=0, must-revalidate',
			// CDN boleh cache singkat per-URL (URL sudah beda karena ?source=)
			// SvelteKit/Workers: s-maxage tetap aman karena query string unik
			// 'CDN-Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30'
		});

		return {
			mangas,
			sources: sources.map((s) => ({ id: s.id, name: s.name })),
			currentSource: sourceId,
			currentPage: page,
			searchQuery: query
		};
	} catch (e) {
		console.error('[Browse] Failed to load manga:', e);
		throw error(500, { message: 'Failed to load manga' });
	}
};
