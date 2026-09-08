<script lang="ts">
	import type { PageData } from './$types';
	import { getLastRead } from '$lib/stores/history';

	const { data }: { data: PageData } = $props();
	let { manga, source } = $derived(data);

	let lastRead = $derived(getLastRead(manga.id));
	let sortNewest = $state(true);
	let viewMode = $state<'list' | 'grid'>('list');

	let chapters = $derived(
		[...(manga.chapters || [])].sort((a, b) =>
			sortNewest ? b.number - a.number : a.number - b.number
		)
	);

	/** Parse baris "Key: value" dari description Hitomi / source lain */
	function parseMeta(desc: string | undefined) {
		const out: Record<string, string> = {};
		if (!desc) return out;
		for (const line of desc.split(/\n+/)) {
			const m = line.match(/^\s*([^:]+):\s*(.+)\s*$/);
			if (m) out[m[1].trim().toLowerCase()] = m[2].trim();
		}
		return out;
	}

	let meta = $derived(parseMeta(manga.description));
	let type = $derived(meta['type'] || '');
	let language = $derived(meta['language'] || '');
	let artists = $derived(meta['artists'] || manga.authors?.join(', ') || '');
	let groups = $derived(meta['groups'] || '');
	let pages = $derived(meta['pages'] || '');

	/** Sinopsis tanpa baris meta Type/Language/... */
	let synopsis = $derived(
		(manga.description || '')
			.split(/\n+/)
			.filter((line) => !/^\s*(type|language|artists|groups|pages)\s*:/i.test(line))
			.join('\n')
			.trim()
	);

	function proxyImage(url: string): string {
		if (!url) return '';
		return `/api/proxy?url=${encodeURIComponent(url)}&source=${source}`;
	}

	function statusClass(status: string) {
		const s = (status || '').toLowerCase();
		if (s.includes('ongoing')) return 'text-emerald-400';
		if (s.includes('complete')) return 'text-sky-400';
		if (s.includes('hiatus')) return 'text-yellow-300';
		return 'text-zinc-400';
	}
</script>

<svelte:head>
	<title>{manga.title} | FanaCumik</title>
	<meta name="description" content={synopsis?.slice(0, 160) || manga.title} />
</svelte:head>

<!-- Container sempit ala Mikoroku (~480px) -->
<div class="mx-auto w-full max-w-[480px] px-3 py-4">
	<div
		class="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0f0f1e] shadow-xl"
	>
		<!-- Blur bg -->
		{#if manga.cover}
			<div
				class="pointer-events-none absolute inset-0 scale-105 bg-cover bg-center opacity-50 blur-[4px]"
				style="background-image: url('{proxyImage(manga.cover)}')"
			></div>
			<div class="absolute inset-0 bg-[#0f0f1e]/70"></div>
		{/if}

		<div class="relative z-10">
			<!-- Main: cover + info -->
			<div class="flex gap-3.5 px-3.5 pt-4">
				<!-- Cover -->
				<div class="w-[90px] shrink-0">
					<div class="aspect-[90/130] overflow-hidden rounded-xl bg-zinc-900 shadow-lg">
						{#if manga.cover}
							<img
								src={proxyImage(manga.cover)}
								alt="{manga.title} cover"
								class="h-full w-full object-cover"
							/>
						{:else}
							<div class="flex h-full items-center justify-center text-zinc-600">
								<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
							</div>
						{/if}
					</div>
				</div>

				<!-- Info kanan -->
				<div class="min-w-0 flex-1 pt-0.5">
					<h1 class="text-[14px] font-bold leading-snug text-white">
						{manga.title}
					</h1>

					<div class="mt-2 space-y-1 text-[11px] text-zinc-200">
						{#if artists}
							<div class="flex items-center gap-1.5">
								<!-- user -->
								<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="shrink-0 text-zinc-400"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
								<span class="truncate">{artists}</span>
							</div>
						{/if}

						{#if groups}
							<div class="flex items-center gap-1.5">
								<!-- users -->
								<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="shrink-0 text-zinc-400"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
								<span class="truncate">{groups}</span>
							</div>
						{/if}

						{#if type}
							<div class="flex items-center gap-1.5">
								<!-- book-type -->
								<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="shrink-0 text-zinc-400"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
								<span class="truncate capitalize">{type}</span>
							</div>
						{/if}

						{#if language}
							<div class="flex items-center gap-1.5">
								<!-- globe -->
								<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="shrink-0 text-zinc-400"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
								<span class="truncate">{language}</span>
							</div>
						{/if}

						<div class="flex items-center gap-1.5">
							<!-- status clock -->
							<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="shrink-0 text-zinc-400"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
							<span class={statusClass(manga.status)}>{manga.status || 'Unknown'}</span>
						</div>

						{#if pages}
							<div class="flex items-center gap-1.5">
								<!-- file / pages -->
								<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="shrink-0 text-zinc-400"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>
								<span>{pages} pages</span>
							</div>
						{:else if manga.chapters?.length}
							<div class="flex items-center gap-1.5">
								<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="shrink-0 text-zinc-400"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
								<span>{manga.chapters.length} chapter</span>
							</div>
						{/if}
					</div>

					<!-- Buttons -->
					<div class="mt-3 flex flex-wrap gap-2">
						{#if lastRead}
							<a
								href="/read/{source}{lastRead.chapterId}"
								class="inline-flex items-center gap-1 rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-[11px] font-semibold text-white"
							>
								<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
								Lanjut
							</a>
						{:else if chapters.length}
							<a
								href="/read/{source}{chapters[chapters.length - 1].id}"
								class="inline-flex items-center gap-1 rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-[11px] font-semibold text-white"
							>
								<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
								Baca
							</a>
						{/if}

						<button
							type="button"
							class="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] text-zinc-200"
						>
							<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/></svg>
							Bookmark
						</button>
					</div>
				</div>
			</div>

			<!-- Genres -->
			{#if manga.genres?.length}
				<div class="mt-4 grid grid-cols-3 gap-2 px-3.5 sm:grid-cols-4">
					{#each manga.genres as genre}
						<span
							class="truncate rounded-lg border border-white/10 bg-black/35 px-2 py-1.5 text-center text-[10px] text-zinc-200"
							title={genre}
						>
							{genre}
						</span>
					{/each}
				</div>
			{/if}

			<!-- Sinopsis (tanpa meta yang sudah di samping cover) -->
			{#if synopsis}
				<section class="mx-3.5 mt-4 rounded-xl border border-white/10 bg-black/25 p-3.5">
					<h2 class="mb-2 text-sm font-semibold text-white">Sinopsis</h2>
					<p class="text-[12px] leading-relaxed text-zinc-300 whitespace-pre-line">{synopsis}</p>
				</section>
			{/if}

			<!-- Chapter tools -->
			<div class="mt-5 flex items-center justify-between gap-2 px-3.5">
				<h2 class="text-sm font-semibold text-white">
					Chapter
					<span class="font-normal text-zinc-500">({chapters.length})</span>
				</h2>
				<div class="flex gap-1.5">
					<button
						type="button"
						class="rounded-lg border px-2.5 py-1 text-[10px] {sortNewest
							? 'border-fuchsia-400/40 bg-fuchsia-500/20 text-fuchsia-200'
							: 'border-amber-400/40 bg-amber-500/20 text-amber-200'}"
						onclick={() => (sortNewest = !sortNewest)}
					>
						{sortNewest ? 'Terbaru' : 'Terlama'}
					</button>
					<button
						type="button"
						class="rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-[10px] text-zinc-300"
						onclick={() => (viewMode = viewMode === 'list' ? 'grid' : 'list')}
					>
						{viewMode === 'list' ? 'Grid' : 'List'}
					</button>
				</div>
			</div>

			<!-- Chapter list -->
			{#if chapters.length}
				{#if viewMode === 'list'}
					<div class="space-y-1.5 px-3.5 pb-5 pt-3">
						{#each chapters as chapter}
							<a
								href="/read/{source}{chapter.id}"
								class="flex items-center justify-between rounded-xl border border-white/10 bg-black/25 px-3.5 py-3 transition hover:bg-white/5"
							>
								<span class="text-[13px] text-zinc-200">{chapter.title}</span>
								<div class="flex items-center gap-2">
									{#if chapter.date}
										<span class="text-[10px] text-zinc-500">{chapter.date}</span>
									{/if}
									<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-zinc-500"><path d="m9 18 6-6-6-6"/></svg>
								</div>
							</a>
						{/each}
					</div>
				{:else}
					<div class="grid grid-cols-3 gap-2 px-3.5 pb-5 pt-3">
						{#each chapters as chapter}
							<a
								href="/read/{source}{chapter.id}"
								class="overflow-hidden rounded-xl border border-white/10 bg-black/30 text-center"
							>
								<div class="flex aspect-square items-center justify-center p-2">
									<span class="line-clamp-3 px-1 text-[11px] font-semibold text-zinc-200">
										{chapter.title}
									</span>
								</div>
							</a>
						{/each}
					</div>
				{/if}
			{:else}
				<p class="px-3.5 py-8 text-center text-sm text-zinc-500">Belum ada chapter.</p>
			{/if}
		</div>
	</div>
</div>
