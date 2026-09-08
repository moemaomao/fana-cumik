import { BaseSource } from '../BaseSource';
import type { Chapter, Manga, MangaDetails } from '../types';

/**
 * Hitomi.la adapter
 *
 * - Latest  : binary .nozomi index (ltn.hitomi.la)
 * - Detail  : galleries/{id}.js  → galleryinfo JSON
 * - Pages   : image URL dari hash + gg.js (CDN gold-usergeneratedcontent.net)
 *
 * Mapping:
 *   Gallery  → Manga
 *   1 chapter → semua file gambar gallery
 */
export class HitomiSource extends BaseSource {
	id = 'hitomi';
	name = 'Hitomi.la';
	baseUrl = 'https://hitomi.la';

	private readonly ltn = 'https://ltn.hitomi.la';
	private readonly cdn = 'gold-usergeneratedcontent.net';

	/** Cache gg.js routing (b & m) */
	private ggB = '';
	private ggM = new Set<number>();
	private ggO = 0;
	private ggLoadedAt = 0;

	// ── Low-level fetch ──────────────────────────────────────────────────────

	private async fetchText(url: string, init?: RequestInit): Promise<string> {
		const res = await fetch(url, {
			...init,
			headers: {
				'User-Agent':
					'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
				Referer: 'https://hitomi.la/',
				...(init?.headers || {})
			}
		});
		if (!res.ok) throw new Error(`Hitomi fetch failed ${res.status}: ${url}`);
		return res.text();
	}

	private async fetchBuffer(url: string, range?: string): Promise<ArrayBuffer> {
		const headers: Record<string, string> = {
			'User-Agent':
				'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
			Referer: 'https://hitomi.la/'
		};
		if (range) headers['Range'] = range;

		const res = await fetch(url, { headers });
		if (!res.ok && res.status !== 206) {
			throw new Error(`Hitomi buffer fetch failed ${res.status}: ${url}`);
		}
		return res.arrayBuffer();
	}

	/** Parse gallery IDs from .nozomi (big-endian int32) */
	private parseNozomi(buf: ArrayBuffer): number[] {
		const view = new DataView(buf);
		const ids: number[] = [];
		for (let i = 0; i + 4 <= view.byteLength; i += 4) {
			ids.push(view.getInt32(i, false));
		}
		return ids;
	}

	/** Load / refresh gg.js routing rules */
	private async ensureGg(): Promise<void> {
		const now = Date.now();
		if (this.ggB && now - this.ggLoadedAt < 30 * 60 * 1000) return;

		const js = await this.fetchText(`${this.ltn}/gg.js?_=${now}`);
		const bMatch = js.match(/b:\s*['"]([^'"]+)['"]/);
		this.ggB = bMatch?.[1] || '';

		this.ggM.clear();
		for (const m of js.matchAll(/case\s+(\d+):/g)) {
			this.ggM.add(parseInt(m[1], 10));
		}

		const oMatch = js.match(/var\s+o\s*=\s*(\d+)/);
		this.ggO = oMatch ? parseInt(oMatch[1], 10) : 0;
		this.ggLoadedAt = now;
	}

	/** gg.s(hash) – last 3 hex chars → decimal path segment */
	private ggS(hash: string): string {
		const m = hash.match(/(..)(.)$/);
		if (!m) return '0';
		return String(parseInt(m[2] + m[1], 16));
	}

	/** Build full image URL (webp preferred) */
	private imageUrl(hash: string, ext: 'webp' | 'avif' = 'webp'): string {
		const s = this.ggS(hash);
		const flag = this.ggM.has(parseInt(s, 10)) ? 1 : 0;
		const subdomain = `${ext[0]}${1 + (flag ^ this.ggO)}`;
		// path: b + s + / + hash
		const path = `${this.ggB}${s}/${hash}`;
		return `https://${subdomain}.${this.cdn}/${path}.${ext}`;
	}

	/** Thumbnail URL (tn subdomain) */
	private thumbUrl(hash: string): string {
		const s = this.ggS(hash);
		const flag = this.ggM.has(parseInt(s, 10)) ? 1 : 0;
		const subdomain = `tn`;
		// small thumb path often uses rearranged hash
		const rearranged = hash.replace(/^.*(..)(.)$/, '$2/$1/' + hash);
		return `https://${subdomain}.${this.cdn}/webpsmalltn/${rearranged}.webp`;
	}

	/** Parse galleryinfo from galleries/{id}.js */
	private parseGalleryInfo(js: string): any {
		const jsonStr = js.replace(/^[^{]*/, '').replace(/;?\s*$/, '');
		return JSON.parse(jsonStr);
	}

	private tagNames(arr: any[] | undefined, key: string): string[] {
		if (!Array.isArray(arr)) return [];
		return arr.map((t) => t?.[key] || t?.tag || t?.name || '').filter(Boolean);
	}

	// ── Catalog ──────────────────────────────────────────────────────────────

	async getLatestManga(page: number): Promise<Manga[]> {
		const p = Math.max(1, Number(page) || 1);
		const perPage = 25;
		const start = (p - 1) * perPage * 4; // 4 bytes per id
		const end = start + perPage * 4 - 1;

		const buf = await this.fetchBuffer(
			`${this.ltn}/index-all.nozomi`,
			`bytes=${start}-${end}`
		);
		const ids = this.parseNozomi(buf);
		if (ids.length === 0) return [];

		await this.ensureGg();

		// Fetch galleryinfo for each id (batch sequential to avoid hammering)
		const mangas: Manga[] = [];
		for (const gid of ids) {
			try {
				const js = await this.fetchText(`${this.ltn}/galleries/${gid}.js`);
				const info = this.parseGalleryInfo(js);
				const title =
					info.title || info.japanese_title || `Gallery ${gid}`;
				const firstHash = info.files?.[0]?.hash || '';
				const cover = firstHash ? this.thumbUrl(firstHash) : '';

				mangas.push({
					id: String(gid),
					title: String(title).trim(),
					cover,
					sourceId: this.id
				});
			} catch {
				// skip broken gallery
			}
		}
		return mangas;
	}

	async searchManga(query: string): Promise<Manga[]> {
		const q = (query || '').trim().toLowerCase().replace(/\s+/g, '_');
		if (!q) return this.getLatestManga(1);

		// Simple tag / title search via nozomi when possible
		// For free-text, try language:all index filtered client-side is too heavy;
		// use tag nozomi if query looks like tag, else fall back to index + filter title.
		let nozomiPath = 'index-all.nozomi';
		if (q.includes(':')) {
			// e.g. language:english, female:sole_female, type:manga
			const [ns, ...rest] = q.split(':');
			const val = rest.join(':');
			if (ns === 'language') {
				nozomiPath = `index-${val}.nozomi`;
			} else if (ns === 'type') {
				nozomiPath = `${val}-all.nozomi`;
			} else {
				nozomiPath = `tag/${ns}:${val}-all.nozomi`;
			}
		}

		const buf = await this.fetchBuffer(
			`${this.ltn}/${nozomiPath}`,
			`bytes=0-99` // first 25
		).catch(() => null);

		let ids: number[] = [];
		if (buf) {
			ids = this.parseNozomi(buf);
		} else {
			// fallback latest
			const latest = await this.fetchBuffer(
				`${this.ltn}/index-all.nozomi`,
				`bytes=0-99`
			);
			ids = this.parseNozomi(latest);
		}

		await this.ensureGg();
		const mangas: Manga[] = [];

		for (const gid of ids) {
			try {
				const js = await this.fetchText(`${this.ltn}/galleries/${gid}.js`);
				const info = this.parseGalleryInfo(js);
				const title = String(info.title || info.japanese_title || '').trim();
				if (
					q.includes(':') ||
					title.toLowerCase().includes(q.replace(/_/g, ' '))
				) {
					const firstHash = info.files?.[0]?.hash || '';
					mangas.push({
						id: String(gid),
						title: title || `Gallery ${gid}`,
						cover: firstHash ? this.thumbUrl(firstHash) : '',
						sourceId: this.id
					});
				}
			} catch {
				/* skip */
			}
		}
		return mangas;
	}

	// ── Details ──────────────────────────────────────────────────────────────

	async getMangaDetails(mangaId: string): Promise<MangaDetails> {
		const gid = String(mangaId).replace(/\D/g, '');
		const js = await this.fetchText(`${this.ltn}/galleries/${gid}.js`);
		const info = this.parseGalleryInfo(js);

		await this.ensureGg();

		const title = String(info.title || info.japanese_title || `Gallery ${gid}`).trim();
		const firstHash = info.files?.[0]?.hash || '';
		const cover = firstHash ? this.thumbUrl(firstHash) : '';

		const artists = this.tagNames(info.artists, 'artist');
		const groups = this.tagNames(info.groups, 'group');
		const characters = this.tagNames(info.characters, 'character');
		const parodies = this.tagNames(info.parodys || info.parodies, 'parody');
		const tags = this.tagNames(info.tags, 'tag');

		const genres = [
			...tags.map((t) => t),
			...characters.map((c) => `character:${c}`),
			...parodies.map((p) => `series:${p}`)
		];

		const description = [
			info.type ? `Type: ${info.type}` : '',
			info.language_localname || info.language
				? `Language: ${info.language_localname || info.language}`
				: '',
			artists.length ? `Artists: ${artists.join(', ')}` : '',
			groups.length ? `Groups: ${groups.join(', ')}` : '',
			info.files ? `Pages: ${info.files.length}` : ''
		]
			.filter(Boolean)
			.join('\n');

		// Satu chapter = seluruh gallery
		const chapters: Chapter[] = [
			{
				id: gid,
				title: 'Read',
				number: 1,
				date: info.date || ''
			}
		];

		return {
			id: gid,
			sourceId: this.id,
			title,
			cover,
			description,
			authors: artists.length ? artists : groups,
			genres,
			status: 'Completed',
			chapters
		};
	}

	// ── Pages ────────────────────────────────────────────────────────────────

	async getChapterPages(chapterId: string): Promise<string[]> {
		const gid = String(chapterId).replace(/\D/g, '');
		const js = await this.fetchText(`${this.ltn}/galleries/${gid}.js`);
		const info = this.parseGalleryInfo(js);
		const files: any[] = info.files || [];

		await this.ensureGg();

		return files
			.map((f) => {
				const hash = f.hash;
				if (!hash) return '';
				// prefer webp, fallback avif if hasavif
				if (f.haswebp !== 0) return this.imageUrl(hash, 'webp');
				if (f.hasavif) return this.imageUrl(hash, 'avif');
				return this.imageUrl(hash, 'webp');
			})
			.filter(Boolean);
	}
}
