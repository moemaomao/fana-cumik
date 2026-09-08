import { BaseSource } from '../BaseSource';
import type { Chapter, Manga, MangaDetails } from '../types';
import * as cheerio from 'cheerio';

/**
 * WeLoMa (weloma.net) adapter
 */
export class WelomaSource extends BaseSource {
	id = 'weloma';
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
		let id = (link || '').trim();
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

	private decodeDataImg(b64: string): string {
		if (!b64) return '';
		try {
			const decoded =
				typeof atob !== 'undefined'
					? atob(b64)
					: Buffer.from(b64, 'base64').toString('utf8');
			return decoded.trim();
		} catch {
			return '';
		}
	}

	private extractCover($el: cheerio.Cheerio<any>): string {
		const dataBg = $el.find('[data-bg]').attr('data-bg');
		if (dataBg) return this.absUrl(dataBg);

		const style =
			$el.find('.img-in-ratio, .content').attr('style') ||
			$el.find('[style*="background-image"]').attr('style') ||
			'';
		const m = style.match(/background-image:\s*url\(['"]?([^'")\s]+)['"]?\)/i);
		if (m?.[1]) return this.absUrl(m[1]);

		const img =
			$el.find('img').attr('src') ||
			$el.find('img').attr('data-src') ||
			'';
		return this.absUrl(img);
	}

	private parseCards($: cheerio.CheerioAPI): Manga[] {
		const mangas: Manga[] = [];
		const seen = new Set<string>();

		$('.thumb-item-flow').each((_, el) => {
			const $el = $(el);
			const a = $el.find('a[href*="/m/"]').first();
			const href = a.attr('href') || '';
			if (!href) return;

			const id = this.cleanId(href);
			if (seen.has(id)) return;
			seen.add(id);

			const title = (
				$el.find('.thumb_attr.series-title a').attr('title') ||
				$el.find('.thumb_attr.series-title a').text() ||
				$el.find('.series-title').text() ||
				a.attr('title') ||
				''
			)
				.replace(/\s+/g, ' ')
				.trim();

			if (!title) return;

			mangas.push({
				id,
				title,
				cover: this.extractCover($el),
				sourceId: this.id
			});
		});

		if (mangas.length === 0) {
			$('a[href*="/m/"]').each((_, el) => {
				const href = $(el).attr('href') || '';
				const id = this.cleanId(href);
				if (!/\/m\/[A-Za-z0-9]+/.test(id) || seen.has(id)) return;
				seen.add(id);

				const title = (($(el).attr('title') || $(el).text()) as string)
					.replace(/\s+/g, ' ')
					.trim();
				if (title) {
					mangas.push({ id, title, cover: '', sourceId: this.id });
				}
			});
		}

		return mangas;
	}

	// ── Catalog ──────────────────────────────────────────────────────────────

	async getLatestManga(page: number): Promise<Manga[]> {
		const p = Math.max(1, Number(page) || 1);
		const path =
			p <= 1
				? '/l/0OYCn?&sort=last_update'
				: `/l/0OYCn?&sort=last_update&page=${p}`;

		const html = await this.fetchHtml(path);
		if (!html || html.length < 500) return [];

		return this.parseCards(cheerio.load(html));
	}

	async searchManga(query: string): Promise<Manga[]> {
		const q = (query || '').trim();
		if (!q) return [];

		const html = await this.fetchHtml(`/search?q=${encodeURIComponent(q)}`);
		if (!html || html.length < 500) return [];

		const $ = cheerio.load(html);
		const mangas = this.parseCards($);

		if (mangas.length === 0) {
			const seen = new Set<string>();
			$('a[href*="/m/"]').each((_, el) => {
				const href = $(el).attr('href') || '';
				const id = this.cleanId(href);
				if (!/\/m\/[A-Za-z0-9]+/.test(id) || seen.has(id)) return;
				seen.add(id);

				const title = (($(el).attr('title') || $(el).text()) as string)
					.replace(/\s+/g, ' ')
					.trim();
				if (title) {
					mangas.push({ id, title, cover: '', sourceId: this.id });
				}
			});
		}

		return mangas;
	}

	// ── Details ──────────────────────────────────────────────────────────────

	async getMangaDetails(mangaId: string): Promise<MangaDetails> {
		const path = this.cleanId(
			mangaId.startsWith('/m/') ? mangaId : `/m/${mangaId.replace(/^\//, '')}`
		);

		const html = await this.fetchHtml(path);
		const $ = cheerio.load(html);

		const title =
			$('h1').first().text().trim() ||
			$('.series-title, .manga-title').first().text().trim() ||
			$('title')
				.text()
				.replace(/\s*[-|]\s*Weloma.*$/i, '')
				.trim() ||
			path;

		let cover =
			$('.info-cover img.thumbnail, .info-cover img, img.thumbnail').first().attr('src') ||
			$('meta[property="og:image"]').attr('content') ||
			'';
		cover = this.absUrl(cover);

		const description =
			$('.summary-content, .series-summary .summary-content, .summary')
				.first()
				.text()
				.replace(/\s+/g, ' ')
				.trim() || '';

		const statusRaw = $('a[href*="manga-on-going"], a[href*="status"]').text().toLowerCase();
		const status =
			/complete|end|finish/.test(statusRaw) ? 'Completed' : 'Ongoing';

		const authors: string[] = [];
		$('.author a, .series-info .author, a[href*="/author/"]').each((_, el) => {
			const t = $(el).text().trim();
			if (t && !authors.includes(t)) authors.push(t);
		});

		// FIX GENRE: Mengambil spesifik dari kontainer genre agar tidak mengambil semua tag/kategori lain
		const genres: string[] = [];
		$('.series-genres a, .genres-content a, .manga-info .genre a').each((_, el) => {
			const t = $(el).text().trim();
			if (t && !genres.includes(t)) genres.push(t);
		});

		const chapters: Chapter[] = [];
		const seen = new Set<string>();

		$('.list-chapters a[href*="/c/"], .chapters-list a[href*="/c/"], a[href*="/c/"]').each((i, el) => {
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

			// FIX NUMBER: Ekstraksi angka chapter lebih akurat (mendukung "Ch. 185", "Chapter 175.5", "185")
			const numMatch = chapterTitle.match(/(?:chap(?:ter)?|ch\.?|\b)\s*(\d+(?:\.\d+)?)/i);
			const number = numMatch && numMatch[1] ? parseFloat(numMatch[1]) : i + 1;

			chapters.push({
				id,
				title: chapterTitle,
				number,
				date: $a.find('.chapter-time, time, .time').text().trim() || ''
			});
		});

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

	// ── Pages ────────────────────────────────────────────────────────────────

	async getChapterPages(chapterId: string): Promise<string[]> {
		const path = this.cleanId(
			chapterId.startsWith('/c/') ? chapterId : `/c/${chapterId.replace(/^\//, '')}`
		);

		const html = await this.fetchHtml(path);
		const $ = cheerio.load(html);
		const images: string[] = [];
		const seen = new Set<string>();

		$('.chapter-content img[data-img], img.lazyload[data-img], img[data-img]').each(
			(_, img) => {
				const url = this.decodeDataImg($(img).attr('data-img') || '');
				if (url && !seen.has(url)) {
					seen.add(url);
					images.push(url);
				}
			}
		);

		if (images.length === 0) {
			$('.chapter-content img, #chapter-content img').each((_, img) => {
				let src =
					$(img).attr('data-src') ||
					$(img).attr('data-original') ||
					$(img).attr('src') ||
					'';
				src = this.absUrl(src);
				if (src && !src.startsWith('data:') && !seen.has(src)) {
					seen.add(src);
					images.push(src);
				}
			});
		}

		return images;
	}
}
