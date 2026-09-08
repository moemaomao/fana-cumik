import { BaseSource } from '../BaseSource';
import type { Chapter, Manga, MangaDetails } from '../types';
import * as cheerio from 'cheerio';

/**
 * Hitomi.la – pakai ltn.gold-usergeneratedcontent.net saja
 */
export class HitomiSource extends BaseSource {
	id = 'hitomi';
	name = 'Hitomi.la';
	baseUrl = 'https://hitomi.la';

	private readonly ltn = 'https://ltn.gold-usergeneratedcontent.net';
	private readonly cdn = 'gold-usergeneratedcontent.net';

	private ggB = '';
	private ggM = new Set<number>();
	private ggO = 0;
	private ggLoadedAt = 0;

	private h(): Record<string, string> {
		return {
			'User-Agent':
				'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
			Referer: 'https://hitomi.la/',
			Accept: '*/*'
		};
	}

	private async getText(url: string): Promise<string> {
		const res = await fetch(url, { headers: this.h() });
		if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
		return res.text();
	}

	private async getBuf(url: string, range: string): Promise<ArrayBuffer> {
		const res = await fetch(url, {
			headers: { ...this.h(), Range: range }
		});
		// 200 atau 206 OK
		if (!res.ok && res.status !== 206) throw new Error(`HTTP ${res.status} ${url}`);
		return res.arrayBuffer();
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

		const js = await this.getText(`${this.ltn}/gg.js?_=${now}`);
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
		const sub = `${ext[0]}${1 + (flag ^ this.ggO)}`;
		return `https://${sub}.${this.cdn}/${this.ggB}${s}/${hash}.${ext}`;
	}

	private thumbFromHash(hash: string): string {
		// path: last1 / last3 / hash
		const a = hash.slice(-1);
		const b = hash.slice(-3);
		return `https://tn.${this.cdn}/webpbigtn/${a}/${b}/${hash}.webp`;
	}

	private parseGalleryInfo(js: string): any {
		const idx = js.indexOf('{');
		if (idx < 0) throw new Error('no JSON in galleryinfo');
		let raw = js.slice(idx).trim();
		if (raw.endsWith(';')) raw = raw.slice(0, -1);
		return JSON.parse(raw);
	}

	/** galleryblock HTML → title + cover (lebih ringan dari .js penuh) */
	private parseBlock(html: string, gid: number): Manga | null {
		const $ = cheerio.load(html);
		const a = $('a.lillie, a[href*=".html"]').first();
		const href = a.attr('href') || '';
		const title =
			$('h1 a, .lillie').first().text().trim() ||
			a.text().trim() ||
			`Gallery ${gid}`;

		let cover =
			$('img.lazyload').attr('data-src') ||
			$('img').attr('data-src') ||
			$('img').attr('src') ||
			'';
		if (cover.startsWith('//')) cover = 'https:' + cover;
		// ganti tn.hitomi.la → tn.gold-usergeneratedcontent.net
		cover = cover.replace('tn.hitomi.la', `tn.${this.cdn}`);

		if (!title) return null;
		return {
			id: String(gid),
			title: title.replace(/\s+/g, ' ').trim(),
			cover,
			sourceId: this.id
		};
	}

	private async loadBrief(gid: number): Promise<Manga | null> {
		try {
			// 1) coba galleryblock (ringan)
			const block = await this.getText(`${this.ltn}/galleryblock/${gid}.html`);
			const fromBlock = this.parseBlock(block, gid);
			if (fromBlock) return fromBlock;
		} catch {
			/* fallback ke .js */
		}
		try {
			const js = await this.getText(`${this.ltn}/galleries/${gid}.js`);
			const info = this.parseGalleryInfo(js);
			const title = String(info.title || info.japanese_title || `Gallery ${gid}`).trim();
			const hash = info.files?.[0]?.hash || '';
			return {
				id: String(gid),
				title,
				cover: hash ? this.thumbFromHash(hash) : '',
				sourceId: this.id
			};
		} catch (e) {
			console.error(`[Hitomi] gid=${gid}`, e);
			return null;
		}
	}

	// ── Catalog ──────────────────────────────────────────────────────────────

	async getLatestManga(page: number): Promise<Manga[]> {
		try {
			const p = Math.max(1, Number(page) || 1);
			const per = 12;
			const start = (p - 1) * per * 4;
			const end = start + per * 4 - 1;

			console.log(`[Hitomi] nozomi bytes=${start}-${end}`);
			const buf = await this.getBuf(
				`${this.ltn}/index-all.nozomi`,
				`bytes=${start}-${end}`
			);
			const ids = this.parseNozomi(buf);
			console.log(`[Hitomi] ids=${ids.length}`, ids.slice(0, 5));

			if (!ids.length) return [];

			const out: Manga[] = [];
			// parallel 3
			for (let i = 0; i < ids.length; i += 3) {
				const chunk = ids.slice(i, i + 3);
				const rows = await Promise.all(chunk.map((id) => this.loadBrief(id)));
				for (const m of rows) if (m) out.push(m);
			}
			console.log(`[Hitomi] parsed=${out.length}`);
			return out;
		} catch (e) {
			console.error('[Hitomi] getLatestManga FAIL', e);
			return [];
		}
	}

	async searchManga(query: string): Promise<Manga[]> {
		const q = (query || '').trim().toLowerCase().replace(/\s+/g, '_');
		if (!q) return this.getLatestManga(1);

		try {
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
				buf = await this.getBuf(`${this.ltn}/${path}`, 'bytes=0-47');
			} catch {
				buf = await this.getBuf(`${this.ltn}/index-all.nozomi`, 'bytes=0-47');
			}

			const ids = this.parseNozomi(buf);
			const out: Manga[] = [];
			for (const gid of ids) {
				const m = await this.loadBrief(gid);
				if (!m) continue;
				if (q.includes(':') || m.title.toLowerCase().includes(q.replace(/_/g, ' '))) {
					out.push(m);
				}
			}
			return out;
		} catch (e) {
			console.error('[Hitomi] search FAIL', e);
			return [];
		}
	}

	async getMangaDetails(mangaId: string): Promise<MangaDetails> {
		const gid = String(mangaId).replace(/\D/g, '');
		const js = await this.getText(`${this.ltn}/galleries/${gid}.js`);
		const info = this.parseGalleryInfo(js);
		await this.ensureGg().catch(() => undefined);

		const title = String(info.title || info.japanese_title || `Gallery ${gid}`).trim();
		const hash = info.files?.[0]?.hash || '';
		const artists = (info.artists || []).map((a: any) => a.artist).filter(Boolean);
		const tags = (info.tags || []).map((t: any) => t.tag).filter(Boolean);

		return {
			id: gid,
			sourceId: this.id,
			title,
			cover: hash ? this.thumbFromHash(hash) : '',
			description: [
				info.type && `Type: ${info.type}`,
				(info.language_localname || info.language) &&
					`Language: ${info.language_localname || info.language}`,
				artists.length && `Artists: ${artists.join(', ')}`,
				info.files && `Pages: ${info.files.length}`
			]
				.filter(Boolean)
				.join('\n'),
			authors: artists,
			genres: tags,
			status: 'Completed',
			chapters: [{ id: gid, title: 'Read', number: 1, date: info.date || '' }]
		};
	}

	async getChapterPages(chapterId: string): Promise<string[]> {
		const gid = String(chapterId).replace(/\D/g, '');
		const js = await this.getText(`${this.ltn}/galleries/${gid}.js`);
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
