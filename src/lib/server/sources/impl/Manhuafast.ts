import { BaseSource } from '../BaseSource';
import type { Chapter, Manga, MangaDetails } from '../types';
import * as cheerio from 'cheerio';

/**
 * WeLoMa (weloma.net) Adapter
 *
 * Custom theme (bukan Madara):
 * - Manga  : /m/{id}
 * - Chapter: /c/{id}
 * - List   : /manga-list.html?sort=last_update&sort_type=DESC&page=N
 * - Search : /search?q=...  (atau endpoint smartSuggest)
 * - Pages  : img.lazyload[data-img]  → base64 URL
 */
export class ManhuafastSource extends BaseSource {
	id = 'manhuafast'; // atau ganti jadi 'weloma' kalau mau
	name = 'WeLoMa';
	baseUrl = 'https://weloma.net';

	// ── Helpers ──────────────────────────────────────────────────────────────

	private absUrl(url: string): string {
		if (!url) return '';
		if (url.startsWith('http')) return url;
		if (url.startsWith('//')) return `https:${url}`;
		return `${this.baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
	}

	private cleanId(link: string): string {
		let id = link.trim();
		if (id.startsWith('http')) {
			try {
				id = new URL(id).pathname;
			} catch {
				/* ignore */
			}
		}
		if (!id.startsWith('/')) id = `/${id}`;
		return id.replace(/\/+$/, '');
	}

	/** Decode base64 data-img → real image URL */
	private decodeDataImg(b64: string): string {
		try {
			// Node / browser compatible
			const decoded =
				typeof atob !== 'undefined'
					? atob(b64)
					: Buffer.from(b64, 'base64').toString('utf8');
			return decoded.trim();
		} catch {
			return '';
		}
	}

	// ── Latest ───────────────────────────────────────────────────────────────

	async getLatestManga(page: number): Promise<Manga[]> {
		const path =
			page <= 1
				? '/manga-list.html?sort=last_update&sort_type=DESC'
				: `/manga-list.html?sort=last_update&sort_type=DESC&page=${page}`;

		const html = await this.fetchHtml(path);
		const $ = cheerio.load(html);
		const mangas: Manga[] = [];
		const seen = new Set<string>();

		// Homepage / list pakai .popular-thumb-item atau item di list
		$('.popular-thumb-item, .thumb-wrapper, .manga-item, .list-item').each((_, el) => {
			const $el = $(el);
			const a = $el.find('a[href*="/m/"]').first();
			const href = a.attr('href') || '';
			if (!href) return;

			const id = this.cleanId(href);
			if (seen.has(id)) return;
			seen.add(id);

			const title =
				$el.find('.series-title, .thumb_attr.series-title, h3, .title').first().text().trim() ||
				a.attr('title') ||
				a.text().trim();

			const img =
				$el.find('img').attr('src') ||
				$el.find('img').attr('data-src') ||
				$el.find('img').attr('data-original') ||
				'';

			if (title && id) {
				mangas.push({
					id,
					title,
					cover: this.absUrl(img),
					sourceId: this.id
				});
			}
		});

		// Fallback: ambil semua link /m/ kalau selector di atas gagal
		if (mangas.length === 0) {
			$('a[href*="/m/"]').each((_, el) => {
				const href = $(el).attr('href') || '';
				const id = this.cleanId(href);
				if (seen.has(id) || !id.includes('/m/')) return;
				seen.add(id);

				const title = $(el).attr('title') || $(el).text().trim();
				if (title) {
					mangas.push({
						id,
						title,
						cover: '',
						sourceId: this.id
					});
				}
			});
		}

		return mangas;
	}

	// ── Search ───────────────────────────────────────────────────────────────

	async searchManga(query: string): Promise<Manga[]> {
		// Endpoint search site
		const html = await this.fetchHtml(`/search?q=${encodeURIComponent(query)}`);
		const $ = cheerio.load(html);
		const mangas: Manga[] = [];
		const seen = new Set<string>();

		$('a[href*="/m/"]').each((_, el) => {
			const href = $(el).attr('href') || '';
			const id = this.cleanId(href);
			if (seen.has(id) || !id.match(/\/m\/[A-Za-z0-9]+/)) return;
			seen.add(id);

			const title =
				$(el).attr('title') ||
				$(el).find('.series-title, .title').text().trim() ||
				$(el).text().trim();

			const img =
				$(el).find('img').attr('src') ||
				$(el).closest('.item, .thumb, .result').find('img').attr('src') ||
				'';

			if (title) {
				mangas.push({
					id,
					title: title.replace(/\s+/g, ' ').trim(),
					cover: this.absUrl(img),
					sourceId: this.id
				});
			}
		});

		return mangas;
	}

	// ── Manga Details ────────────────────────────────────────────────────────

	async getMangaDetails(mangaId: string): Promise<MangaDetails> {
		const path = this.cleanId(mangaId.startsWith('/m/') ? mangaId : `/m/${mangaId.replace(/^\//, '')}`);
		const html = await this.fetchHtml(path);
		const $ = cheerio.load(html);

		// Title
		const title =
			$('h1, .series-title, .manga-title, title')
				.first()
				.text()
				.replace(/\s*-\s*Weloma.*$/i, '')
				.trim() || path;

		// Cover
		let cover =
			$('.info-cover img.thumbnail, .info-cover img, img.thumbnail').first().attr('src') ||
			$('meta[property="og:image"]').attr('content') ||
			'';
		cover = this.absUrl(cover);

		// Description
		const description =
			$('.summary-content, .series-summary, .summary, .description')
				.first()
				.text()
				.replace(/\s+/g, ' ')
				.trim() || '';

		// Status
		const statusText = $('a[href*="manga-on-going"], a[href*="status"]').text().trim().toLowerCase();
		const status = statusText.includes('complete') || statusText.includes('end') ? 'Completed' : 'Ongoing';

		// Authors
		const authors: string[] = [];
		$('a[href*="/l/"][data-title*="Author"], .author a, a[href*="author"]').each((_, el) => {
			const t = $(el).text().trim();
			if (t) authors.push(t);
		});

		// Genres
		const genres: string[] = [];
		$('a[href*="/l/"][data-title*="Genre"], .genres a, a[href*="genre"]').each((_, el) => {
			const t = $(el).text().trim();
			if (t && !genres.includes(t)) genres.push(t);
		});

		// Chapters – .list-chapters a[href*="/c/"]
		const chapters: Chapter[] = [];
		const seen = new Set<string>();

		$('.list-chapters a[href*="/c/"], a[href*="/c/"]').each((i, el) => {
			const $a = $(el);
			const href = $a.attr('href') || '';
			if (!href) return;

			const id = this.cleanId(href);
			if (seen.has(id)) return;
			seen.add(id);

			const chapterTitle =
				$a.find('.chapter-name').text().trim() ||
				$a.attr('title') ||
				$a.text().replace(/\s+/g, ' ').trim() ||
				`Chapter ${i + 1}`;

			const numMatch = chapterTitle.match(/(?:chap(?:ter)?|ch\.?)\s*(\d+(?:\.\d+)?)/i);
			const number = numMatch ? parseFloat(numMatch[1]) : i + 1;

			chapters.push({
				id,
				title: chapterTitle,
				number,
				date: $a.find('.chapter-time').text().trim() || ''
			});
		});

		// Sort ascending
		chapters.sort((a, b) => a.number - b.number);

		return {
			id: path,
			sourceId: this.id,
			title,
			cover,
			description,
			authors,
			genres,
			status,
			chapters
		};
	}

	// ── Chapter Pages ────────────────────────────────────────────────────────

	async getChapterPages(chapterId: string): Promise<string[]> {
		const path = this.cleanId(chapterId.startsWith('/c/') ? chapterId : `/c/${chapterId.replace(/^\//, '')}`);
		const html = await this.fetchHtml(path);
		const $ = cheerio.load(html);
		const images: string[] = [];
		const seen = new Set<string>();

		// Primary: data-img (base64 encoded real URL)
		$('.chapter-content img.lazyload, .chapter-content img[data-img], img[data-img]').each((_, img) => {
			const b64 = $(img).attr('data-img') || '';
			if (!b64) return;
			const url = this.decodeDataImg(b64);
			if (url && !seen.has(url)) {
				seen.add(url);
				images.push(url);
			}
		});

		// Fallback: data-src / src biasa
		if (images.length === 0) {
			$('.chapter-content img, #chapter-content img, .reading-content img').each((_, img) => {
				let src =
					$(img).attr('data-src') ||
					$(img).attr('data-original') ||
					$(img).attr('src') ||
					'';
				src = this.absUrl(src);
				if (src && !src.includes('data:image') && !seen.has(src)) {
					seen.add(src);
					images.push(src);
				}
			});
		}

		return images;
	}
}
