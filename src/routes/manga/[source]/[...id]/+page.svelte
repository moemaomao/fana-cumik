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
	let author = $derived(meta['author'] || meta['authors'] || '');

	let synopsis = $derived(
		(manga.description || '')
			.split(/\n+/)
			.filter((line) => !/^\s*(type|language|artists?|groups?|pages)\s*:/i.test(line))
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

<!-- Lebih lebar di desktop, tetap nyaman di mobile -->
<div class="mx-auto w-full max-w-3xl px-4 py-6">
	<div class="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0f0f1e] shadow-xl">
		{#if manga.cover}
			<div
				class="pointer-events-none absolute inset-0 scale-105 bg-cover bg-center opacity-40 blur-md"
				style="background-image: url('{proxyImage(manga.cover)}')"
			></div>
			<div class="absolute inset-0 bg-[#0f0f1e]/75"></div>
		{/if}

		<div class="relative z-10 p-4 sm:p-6">
			<!-- Header -->
			<div class="flex flex-col gap-5 sm:flex-row sm:gap-6">
				<!-- Cover -->
				<div class="mx-auto w-[120px] shrink-0 sm:mx-0 sm:w-[140px]">
					<div class="aspect-[2/3] overflow-hidden rounded-xl bg-zinc-900 shadow-lg">
						{#if manga.cover}
							<img
								src={proxyImage(manga.cover)}
								alt="{manga.title} cover"
								class="h-full w-full object-cover"
							/>
						{:else}
							<div class="flex h-full items-center justify-center text-zinc-600">
								<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
							</div>
						{/if}
					</div>
				</div>

				<!-- Info -->
				<div class="min-w-0 flex-1">
					<h1 class="text-lg font-bold leading-snug text-white sm:text-2xl">
						{manga.title}
					</h1>

					<!-- Detail rows: icon + label + value -->
					<div class="mt-3 space-y-2 text-sm text-zinc-200">
						{#if artists || author}
							<div class="flex items-start gap-2">
								<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="mt-0.5 shrink-0 text-zinc-400"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
								<p>
									<span class="text-zinc-500">Artist:</span>
									<span class="ml-1 text-zinc-100">{artists || author}</span>
								</p>
							</div>
						{/if}

						{#if groups}
							<div class="flex items-start gap-2">
								<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="mt-0.5 shrink-0 text-zinc-400"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
								<p>
									<span class="text-zinc-500">Group:</span>
									<span class="ml-1 text-zinc-100">{groups}</span>
								</p>
							</div>
						{/if}

						{#if type}
							<div class="flex items-start gap-2">
								<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="mt-0.5 shrink-0 text-zinc-400"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
								<p>
									<span class="text-zinc-500">Type:</span>
									<span class="ml-1 capitalize text-zinc-100">{type}</span>
								</p>
							</div>
						{/if}

						{#if language}
							<div class="flex items-start gap-2">
								<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="mt-0.5 shrink-0 text-zinc-400"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
								<p>
									<span class="text-zinc-500">Language:</span>
									<span class="ml-1 text-zinc-100">{language}</span>
								</p>
							</div>
						{/if}

						<div class="flex items-start gap-2">
							<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="mt-0.5 shrink-0 text-zinc-400"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
							<p>
								<span class="text-zinc-500">Status:</span>
								<span class="ml-1 {statusClass(manga.status)}">{manga.status || 'Unknown'}</span>
							</p>
						</div>

						{#if pages}
							<div class="flex items-start gap-2">
								<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="mt-0.5 shrink-0 text-zinc-400"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>
								<p>
									<span class="text-zinc-500">Pages:</span>
									<span class="ml-1 text-zinc-100">{pages}</span>
								</p>
							</div>
						{/if}

						{#if manga.chapters?.length}
							<div class="flex items-start gap-2">
								<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="mt-0.5 shrink-0 text-zinc-400"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
								<p>
									<span class="text-zinc-500">Chapters:</span>
									<span class="ml-1 text-zinc-100">{manga.chapters.length}</span>
								</p>
							</div>
						{/if}
					</div>

					<!-- Actions -->
					<div class="mt-4 flex flex-wrap gap-2">
						{#if lastRead}
							<a
								href="/read/{source}{lastRead.chapterId}"
								class="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white"
							>
								Baca lanjut
							</a>
						{:else if chapters.length}
							<a
								href="/read/{source}{chapters[chapters.length - 1].id}"
								class="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white"
							>
								Baca
							</a>
						{/if}
						<button
							type="button"
							class="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm text-zinc-200"
						>
							Bookmark
						</button>
					</div>
				</div>
			</div>

			<!-- Genres -->
			{#if manga.genres?.length}
				<div class="mt-5 flex flex-wrap gap-2">
					{#each manga.genres as genre}
						<span
							class="rounded-lg border border-white/10 bg-black/35 px-3 py-1.5 text-xs text-zinc-200"
						>
							{genre}
						</span>
					{/each}
				</div>
			{/if}

			<!-- Sinopsis -->
			{#if synopsis}
				<section class="mt-5 rounded-xl border border-white/10 bg-black/25 p-4">
					<h2 class="mb-2 text-base font-semibold text-white">Sinopsis</h2>
					<p class="text-sm leading-relaxed text-zinc-300 whitespace-pre-line">{synopsis}</p>
				</section>
			{/if}

			<!-- Chapter header -->
			<div class="mt-6 flex items-center justify-between gap-2">
				<h2 class="text-base font-semibold text-white">
					Chapter
					<span class="font-normal text-zinc-500">({chapters.length})</span>
				</h2>
				<div class="flex gap-2">
					<button
						type="button"
						class="rounded-lg border px-3 py-1.5 text-xs {sortNewest
							? 'border-fuchsia-400/40 bg-fuchsia-500/20 text-fuchsia-200'
							: 'border-amber-400/40 bg-amber-500/20 text-amber-200'}"
						onclick={() => (sortNewest = !sortNewest)}
					>
						{sortNewest ? 'Terbaru' : 'Terlama'}
					</button>
					<button
						type="button"
						class="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-zinc-300"
						onclick={() => (viewMode = viewMode === 'list' ? 'grid' : 'list')}
					>
						{viewMode === 'list' ? 'Grid' : 'List'}
					</button>
				</div>
			</div>

			<!-- Chapters -->
			{#if chapters.length}
				{#if viewMode === 'list'}
					<div class="mt-3 space-y-1.5 pb-2">
						{#each chapters as chapter}
							<a
								href="/read/{source}{chapter.id}"
								class="flex items-center justify-between rounded-xl border border-white/10 bg-black/25 px-4 py-3 transition hover:bg-white/5"
							>
								<span class="text-sm text-zinc-200">{chapter.title}</span>
								<div class="flex items-center gap-2">
									{#if chapter.date}
										<span class="text-xs text-zinc-500">{chapter.date}</span>
									{/if}
									<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-zinc-500"><path d="m9 18 6-6-6-6"/></svg>
								</div>
							</a>
						{/each}
					</div>
				{:else}
					<div class="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 pb-2">
						{#each chapters as chapter}
							<a
								href="/read/{source}{chapter.id}"
								class="overflow-hidden rounded-xl border border-white/10 bg-black/30 text-center"
							>
								<div class="flex aspect-square items-center justify-center p-2">
									<span class="line-clamp-3 px-1 text-xs font-semibold text-zinc-200">
										{chapter.title}
									</span>
								</div>
							</a>
						{/each}
					</div>
				{/if}
			{:else}
				<p class="py-8 text-center text-sm text-zinc-500">Belum ada chapter.</p>
			{/if}
		</div>
	</div>
</div>
