import { BaseSource } from '../BaseSource';
import type { Chapter, Manga, MangaDetails } from '../types';

/**
 * Hitomi.la – resilient for Cloudflare Workers
 */
export class HitomiSource extends BaseSource {
	id = 'hitomi';
	name = 'Hitomi.la';
	baseUrl = 'https://hitomi.la';

	/** Coba beberapa host LTN (Worker sering block salah satu) */
	private readonly ltnHosts = [
		'https://ltn.hitomi.la',
		'https://ltn.gold-usergeneratedcontent.net'
	];
	private readonly cdn = 'gold-usergeneratedcontent.net';

	private ggB = '';
	private ggM = new Set<number>();
	private ggO = 0;
	private ggLoadedAt = 0;
	private workingLtn = '';

	private headers(): Record<string, string> {
		return {
			'User-Agent':
				'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
			Referer: 'https://hitomi.la/',
			Accept: '*/*'
		};
	}

	private async fetchText(url: string): Promise<string> {
		const res = await fetch(url, { headers: this.headers() });
		if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
		return res.text();
	}

	private async fetchBuffer(url: string, range?: string): Promise<ArrayBuffer> {
		const h = this.headers();
		if (range) h['Range'] = range;
		const res = await fetch(url, { headers: h });
		if (!res.ok && res.status !== 206) throw new Error(`HTTP ${res.status} ${url}`);
		return res.arrayBuffer();
	}

	/** Pilih LTN host yang bisa dihubungi */
	private async resolveLtn(): Promise<string> {
		if (this.workingLtn) return this.workingLtn;
		for (const host of this.ltnHosts) {
			try {
				const res = await fetch(`${host}/gg.js`, {
					headers: this.headers(),
					method: 'HEAD'
				});
				if (res.ok || res.status === 405) {
					this.workingLtn = host;
					return host;
				}
			} catch {
				/* try next */
			}
		}
		// fallback default
		this.workingLtn = this.ltnHosts[0];
		return this.workingLtn;
	}

	private parseNozomi(buf: ArrayBuffer): number[] {
		const view = new DataView(buf);
		const ids: number[] = [];
		for (let i = 0; i + 4 <= view.byteLength; i += 4) {
			ids.push(view.getInt32(i, false));
		}
		return ids;
	}

	private async ensureGg(): Promise<void> {
		const now = Date.now();
		if (this.ggB && now - this.ggLoadedAt < 30 * 60 * 1000) return;

		const ltn = await this.resolveLtn();
		const js = await this.fetchText(`${ltn}/gg.js?_=${now}`);

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

	private ggS(hash: string): string {
		const m = hash.match(/(..)(.)$/);
		if (!m) return '0';
		return String(parseInt(m[2] + m[1], 16));
	}

	private imageUrl(hash: string, ext: 'webp' | 'avif' = 'webp'): string {
		const s = this.ggS(hash);
		const flag = this.ggM.has(parseInt(s, 10)) ? 1 : 0;
		const subdomain = `${ext[0]}${1 + (flag ^ this.ggO)}`;
		return `https://${subdomain}.${this.cdn}/${this.ggB}${s}/${hash}.${ext}`;
	}

	private thumbUrl(hash: string): string {
		const rearranged = hash.replace(/^.*(..)(.)$/, '$2/$1/' + hash);
		return `https://tn.${this.cdn}/webpsmalltn/${rearranged}.webp`;
	}

	private parseGalleryInfo(js: string): any {
		const cleaned = js.replace(/^[\s\S]*?=\s*/, '').replace(/;?\s*$/, '');
		return JSON.parse(cleaned);
	}

	private tagNames(arr: any[] | undefined, key: string): string[] {
		if (!Array.isArray(arr)) return [];
		return arr.map((t) => t?.[key] || t?.tag || '').filter(Boolean);
	}

	/** Ambil metadata 1 gallery; gagal → null (jangan throw) */
	private async loadGalleryBrief(gid: number): Promise<Manga | null> {
		try {
			const ltn = await this.resolveLtn();
			const js = await this.fetchText(`${ltn}/galleries/${gid}.js`);
			const info = this.parseGalleryInfo(js);
			const title = String(info.title || info.japanese_title || `Gallery ${gid}`).trim();
			const hash = info.files?.[0]?.hash || '';
			return {
				id: String(gid),
				title,
				cover: hash ? this.thumbUrl(hash) : '',
				sourceId: this.id
			};
		} catch (e) {
			console.error(`[Hitomi] gallery ${gid}`, e);
			return null;
		}
	}

	// ── Catalog ──────────────────────────────────────────────────────────────

	async getLatestManga(page: number): Promise<Manga[]> {
		try {
			const p = Math.max(1, Number(page) || 1);
			const perPage = 12; // kecilkan biar tidak timeout di Worker
			const start = (p - 1) * perPage * 4;
			const end = start + perPage * 4 - 1;

			const ltn = await this.resolveLtn();
			const buf = await this.fetchBuffer(
				`${ltn}/index-all.nozomi`,
				`bytes=${start}-${end}`
			);
			const ids = this.parseNozomi(buf);
			if (!ids.length) return [];

			await this.ensureGg().catch(() => undefined);

			// Parallel terbatas (max 4 sekaligus)
			const mangas: Manga[] = [];
			for (let i = 0; i < ids.length; i += 4) {
				const chunk = ids.slice(i, i + 4);
				const results = await Promise.all(chunk.map((id) => this.loadGalleryBrief(id)));
				for (const m of results) if (m) mangas.push(m);
			}
			return mangas;
		} catch (e) {
			console.error('[Hitomi] getLatestManga', e);
			return []; // Jangan throw → hindari 500 di UI
		}
	}

	async searchManga(query: string): Promise<Manga[]> {
		try {
			const q = (query || '').trim().toLowerCase().replace(/\s+/g, '_');
			if (!q) return this.getLatestManga(1);

			const ltn = await this.resolveLtn();
			let path = 'index-all.nozomi';
			if (q.includes(':')) {
				const [ns, ...rest] = q.split(':');
				const val = rest.join(':');
				if (ns === 'language') path = `index-${val}.nozomi`;
				else if (ns === 'type') path = `${val}-all.nozomi`;
				else path = `tag/${ns}:${val}-all.nozomi`;
			}

			let buf: ArrayBuffer;
			try {
				buf = await this.fetchBuffer(`${ltn}/${path}`, 'bytes=0-47');
			} catch {
				buf = await this.fetchBuffer(`${ltn}/index-all.nozomi`, 'bytes=0-47');
			}

			const ids = this.parseNozomi(buf);
			await this.ensureGg().catch(() => undefined);

			const mangas: Manga[] = [];
			for (const gid of ids) {
				const m = await this.loadGalleryBrief(gid);
				if (!m) continue;
				if (
					q.includes(':') ||
					m.title.toLowerCase().includes(q.replace(/_/g, ' '))
				) {
					mangas.push(m);
				}
			}
			return mangas;
		} catch (e) {
			console.error('[Hitomi] searchManga', e);
			return [];
		}
	}

	async getMangaDetails(mangaId: string): Promise<MangaDetails> {
		const gid = String(mangaId).replace(/\D/g, '');
		const ltn = await this.resolveLtn();
		const js = await this.fetchText(`${ltn}/galleries/${gid}.js`);
		const info = this.parseGalleryInfo(js);
		await this.ensureGg().catch(() => undefined);

		const title = String(info.title || info.japanese_title || `Gallery ${gid}`).trim();
		const hash = info.files?.[0]?.hash || '';
		const artists = this.tagNames(info.artists, 'artist');
		const groups = this.tagNames(info.groups, 'group');
		const tags = this.tagNames(info.tags, 'tag');

		return {
			id: gid,
			sourceId: this.id,
			title,
			cover: hash ? this.thumbUrl(hash) : '',
			description: [
				info.type && `Type: ${info.type}`,
				(info.language_localname || info.language) &&
					`Language: ${info.language_localname || info.language}`,
				artists.length && `Artists: ${artists.join(', ')}`,
				info.files && `Pages: ${info.files.length}`
			]
				.filter(Boolean)
				.join('\n'),
			authors: artists.length ? artists : groups,
			genres: tags,
			status: 'Completed',
			chapters: [{ id: gid, title: 'Read', number: 1, date: info.date || '' }]
		};
	}

	async getChapterPages(chapterId: string): Promise<string[]> {
		const gid = String(chapterId).replace(/\D/g, '');
		const ltn = await this.resolveLtn();
		const js = await this.fetchText(`${ltn}/galleries/${gid}.js`);
		const info = this.parseGalleryInfo(js);
		await this.ensureGg();

		return (info.files || [])
			.map((f: any) => {
				if (!f?.hash) return '';
				if (f.haswebp !== 0) return this.imageUrl(f.hash, 'webp');
				if (f.hasavif) return this.imageUrl(f.hash, 'avif');
				return this.imageUrl(f.hash, 'webp');
			})
			.filter(Boolean);
	}
}
