import { BaseSource } from '../BaseSource';
import type { Chapter, Manga, MangaDetails } from '../types';
import * as cheerio from 'cheerio';

/**
 * WeLoMa (weloma.net) Adapter – fixed selectors
 */
export class ManhuafastSource extends BaseSource {
	id = 'manhuafast';
	name = 'WeLoMa';
	baseUrl = 'https://weloma.net';

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

	private decodeDataImg(b64: string): string {
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

	/** Ambil cover dari style background-image atau data-bg */
	private extractCover($el: cheerio.Cheerio<any>): string {
		// 1. data-bg
		const dataBg = $el.find('[data-bg]').attr('data-bg');
		if (dataBg) return this.absUrl(dataBg);

		// 2. style="background-image: url('...')"
		const style =
			$el.find('.img-in-ratio, .content').attr('style') ||
			$el.find('[style*="background-image"]').attr('style') ||
			'';
		const m = style.match(/background-image:\s*url\(['"]?([^'")\s]+)['"]?\)/i);
		if (m?.[1]) return this.absUrl(m[1]);

		// 3. fallback img
		const img =
			$el.find('img').attr('src') ||
			$el.find('img').attr('data-src') ||
			'';
		return this.absUrl(img);
	}

	// ── Latest ───────────────────────────────────────────────────────────────

	async getLatestManga(page: number): Promise<Manga[]> {
		// List terbaru: /l/0OYCn?&sort=last_update  (+ &page=N)
		// Homepage juga punya .thumb-item-flow
		const path =
			page <= 1
				? '/l/0OYCn?&sort=last_update'
				: `/l/0OYCn?&sort=last_update&page=${page}`;

		const html = await this.fetchHtml(path);
		const $ = cheerio.load(html);
		const mangas: Manga[] = [];
		const seen = new Set<string>();

		$('.thumb-item-flow').each((_, el) => {
			const $el = $(el);

			// Link manga
			const a = $el.find('a[href*="/m/"]').first();
			const href = a.attr('href') || '';
			if (!href) return;

			const id = this.cleanId(href);
			if (seen.has(id)) return;
			seen.add(id);

			// Title
			const title =
				$el.find('.thumb_attr.series-title a').attr('title') ||
				$el.find('.thumb_attr.series-title a').text().trim() ||
				$el.find('.series-title').text().trim() ||
				a.attr('title') ||
				'';

			const cover = this.extractCover($el);

			if (title && id) {
				mangas.push({
					id,
					title: title.replace(/\s+/g, ' ').trim(),
					cover,
					sourceId: this.id
				});
			}
		});

		// Fallback keras: semua link /m/
		if (mangas.length === 0) {
			$('a[href*="/m/"]').each((_, el) => {
				const href = $(el).attr('href') || '';
				const id = this.cleanId(href);
				if (!id.match(/\/m\/[A-Za-z0-9]+/) || seen.has(id)) return;
				seen.add(id);

				const title = ($(el).attr('title') || $(el).text()).replace(/\s+/g, ' ').trim();
				if (title) {
					mangas.push({ id, title, cover: '', sourceId: this.id });
				}
			});
		}

		return mangas;
	}

	// ── Search ───────────────────────────────────────────────────────────────

	async searchManga(query: string): Promise<Manga[]> {
		const html = await this.fetchHtml(`/search?q=${encodeURIComponent(query)}`);
		const $ = cheerio.load(html);
		const mangas: Manga[] = [];
		const seen = new Set<string>();

		// Coba struktur yang sama dulu
		$('.thumb-item-flow, .search-item, .item').each((_, el) => {
			const $el = $(el);
			const a = $el.find('a[href*="/m/"]').first();
			const href = a.attr('href') || '';
			if (!href) return;

			const id = this.cleanId(href);
			if (seen.has(id)) return;
			seen.add(id);

			const title =
				$el.find('.series-title a, .thumb_attr.series-title a').attr('title') ||
				$el.find('.series-title, .title').text().trim() ||
				a.attr('title') ||
				a.text().trim();

			const cover = this.extractCover($el);

			if (title) {
				mangas.push({
					id,
					title: title.replace(/\s+/g, ' ').trim(),
					cover,
					sourceId: this.id
				});
			}
		});

		// Fallback
		if (mangas.length === 0) {
			$('a[href*="/m/"]').each((_, el) => {
				const href = $(el).attr('href') || '';
				const id = this.cleanId(href);
				if (!id.match(/\/m\/[A-Za-z0-9]+/) || seen.has(id)) return;
				seen.add(id);
				const title = ($(el).attr('title') || $(el).text()).replace(/\s+/g, ' ').trim();
				if (title) mangas.push({ id, title, cover: '', sourceId: this.id });
			});
		}

		return mangas;
	}

	// ── Manga Details ────────────────────────────────────────────────────────

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
				.replace(/\s*-\s*Weloma.*$/i, '')
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
			statusRaw.includes('complete') || statusRaw.includes('end') ? 'Completed' : 'Ongoing';

		const authors: string[] = [];
		$('a[href*="/l/"][data-title*="Author"], .author a').each((_, el) => {
			const t = $(el).text().trim();
			if (t) authors.push(t);
		});

		const genres: string[] = [];
		$('a[href*="/l/"][data-title*="Genre"], .genres a').each((_, el) => {
			const t = $(el).text().trim();
			if (t && !genres.includes(t)) genres.push(t);
		});

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
				date: $a.find('.chapter-time, time').text().trim() || ''
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

	// ── Chapter Pages ────────────────────────────────────────────────────────

	async getChapterPages(chapterId: string): Promise<string[]> {
		const path = this.cleanId(
			chapterId.startsWith('/c/') ? chapterId : `/c/${chapterId.replace(/^\//, '')}`
		);
		const html = await this.fetchHtml(path);
		const $ = cheerio.load(html);
		const images: string[] = [];
		const seen = new Set<string>();

		// Primary: data-img (base64)
		$('.chapter-content img[data-img], img.lazyload[data-img], img[data-img]').each(
			(_, img) => {
				const b64 = $(img).attr('data-img') || '';
				if (!b64) return;
				const url = this.decodeDataImg(b64);
				if (url && !seen.has(url)) {
					seen.add(url);
					images.push(url);
				}
			}
		);

		// Fallback
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
