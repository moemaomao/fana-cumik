<script lang="ts">
	import type { PageData } from './$types';

	const { data }: { data: PageData } = $props();
	let { manga, source } = $derived(data);

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
	let author = $derived(meta['author'] || '');

	let synopsis = $derived(
		(manga.description || '')
			.split(/\n+/)
			.filter((line) => !/^\s*(type|language|artists?|groups?|pages|author)\s*:/i.test(line))
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

<!-- Lebar mendekati area konten Mikoroku -->
<div class="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
	<div class="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0f0f1e] shadow-2xl">
		{#if manga.cover}
			<div
				class="pointer-events-none absolute inset-0 scale-105 bg-cover bg-center opacity-45 blur-md"
				style="background-image: url('{proxyImage(manga.cover)}')"
			></div>
			<div class="absolute inset-0 bg-[#0f0f1e]/70"></div>
		{/if}

		<div class="relative z-10 p-5 sm:p-8">
			<!-- Header: cover kiri + info kanan (lebar) -->
			<div class="flex flex-col gap-6 md:flex-row md:gap-8">
				
				<!-- Kolom Cover Kiri (Cover + Rating + Bookmark) -->
				<div class="mx-auto flex w-[150px] shrink-0 flex-col items-center gap-3 sm:w-[170px] md:mx-0 md:w-[190px]">
					<div class="aspect-[2/3] w-full overflow-hidden rounded-xl bg-zinc-900 shadow-xl ring-1 ring-white/10">
						{#if manga.cover}
							<img
								src={proxyImage(manga.cover)}
								alt="{manga.title} cover"
								class="h-full w-full object-cover"
							/>
						{:else}
							<div class="flex h-full items-center justify-center text-zinc-600">
								<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
							</div>
						{/if}
					</div>

					<!-- Rating Bintang -->
					<div class="flex items-center gap-1.5 text-sm font-semibold text-yellow-400">
						<div class="flex text-amber-400">
							{#each Array(5) as _, i}
								<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
							{/each}
						</div>
						<span class="text-xs text-zinc-300">8.2</span>
					</div>

					<!-- Tombol Bookmark -->
					<button
						type="button"
						class="flex w-full items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 py-2.5 text-sm font-medium text-white transition hover:bg-white/20"
					>
						<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/></svg>
						Bookmark
					</button>
				</div>

				<!-- Info Kanan -->
				<div class="min-w-0 flex-1">
					<h1 class="text-xl font-bold leading-snug text-white sm:text-2xl md:text-3xl">
						{manga.title}
					</h1>

					<div class="mt-4 grid gap-2.5 text-sm text-zinc-200 sm:text-[15px]">
						{#if author}
							<div class="flex items-start gap-2.5">
								<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="mt-0.5 shrink-0 text-zinc-400"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
								<p><span class="text-zinc-500">Author:</span> <span class="text-zinc-100">{author}</span></p>
							</div>
						{/if}

						{#if artists}
							<div class="flex items-start gap-2.5">
								<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="mt-0.5 shrink-0 text-zinc-400"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
								<p><span class="text-zinc-500">Artist:</span> <span class="text-zinc-100">{artists}</span></p>
							</div>
						{/if}

						{#if groups}
							<div class="flex items-start gap-2.5">
								<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="mt-0.5 shrink-0 text-zinc-400"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
								<p><span class="text-zinc-500">Group:</span> <span class="text-zinc-100">{groups}</span></p>
							</div>
						{/if}

						{#if type}
							<div class="flex items-start gap-2.5">
								<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="mt-0.5 shrink-0 text-zinc-400"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
								<p><span class="text-zinc-500">Type:</span> <span class="capitalize text-zinc-100">{type}</span></p>
							</div>
						{/if}

						{#if language}
							<div class="flex items-start gap-2.5">
								<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="mt-0.5 shrink-0 text-zinc-400"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
								<p><span class="text-zinc-500">Language:</span> <span class="text-zinc-100">{language}</span></p>
							</div>
						{/if}

						<div class="flex items-start gap-2.5">
							<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="mt-0.5 shrink-0 text-zinc-400"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
							<p>
								<span class="text-zinc-500">Status:</span>
								<span class="ml-1 font-semibold uppercase {statusClass(manga.status)}">
									{manga.status || 'Unknown'}
								</span>
							</p>
						</div>

						{#if pages}
							<div class="flex items-start gap-2.5">
								<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="mt-0.5 shrink-0 text-zinc-400"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>
								<p><span class="text-zinc-500">Pages:</span> <span class="text-zinc-100">{pages}</span></p>
							</div>
						{/if}

						{#if manga.chapters?.length}
							<div class="flex items-start gap-2.5">
								<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="mt-0.5 shrink-0 text-zinc-400"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
								<p>
									<span class="text-zinc-500">Chapter:</span>
									<span class="text-zinc-100">{manga.chapters.length} Chapters</span>
								</p>
							</div>
						{/if}
					</div>
				</div>
			</div>

			<!-- Genres -->
			{#if manga.genres?.length}
				<div class="mt-6 flex flex-wrap gap-2">
					{#each manga.genres as genre}
						<span
							class="rounded-lg border border-white/10 bg-black/40 px-3.5 py-2 text-xs text-zinc-200 sm:text-sm"
						>
							{genre}
						</span>
					{/each}
				</div>
			{/if}

			<!-- Synopsis -->
			{#if synopsis}
				<section class="mt-6 rounded-xl border border-white/10 bg-black/30 p-5">
					<h2 class="mb-3 text-lg font-semibold text-white">Synopsis</h2>
					<p class="text-sm leading-relaxed text-zinc-300 sm:text-[15px] whitespace-pre-line">
						{synopsis}
					</p>
				</section>
			{/if}

			<!-- Chapters -->
			<div class="mt-8 flex items-center justify-between gap-3">
				<h2 class="text-lg font-semibold text-white">
					Chapter
					<span class="font-normal text-zinc-500">({chapters.length})</span>
				</h2>
				<div class="flex gap-2">
					<button
						type="button"
						class="rounded-lg border px-3 py-1.5 text-xs sm:text-sm {sortNewest
							? 'border-fuchsia-400/40 bg-fuchsia-500/20 text-fuchsia-200'
							: 'border-amber-400/40 bg-amber-500/20 text-amber-200'}"
						onclick={() => (sortNewest = !sortNewest)}
					>
						{sortNewest ? 'Terbaru' : 'Terlama'}
					</button>
					<button
						type="button"
						class="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-zinc-300 sm:text-sm"
						onclick={() => (viewMode = viewMode === 'list' ? 'grid' : 'list')}
					>
						{viewMode === 'list' ? 'Grid' : 'List'}
					</button>
				</div>
			</div>

			{#if chapters.length}
				{#if viewMode === 'list'}
					<div class="mt-3 space-y-2">
						{#each chapters as chapter}
							<a
								href="/read/{source}{chapter.id}"
								class="flex items-center justify-between rounded-xl border border-white/10 bg-black/25 px-4 py-3.5 transition hover:bg-white/5"
							>
								<span class="text-sm text-zinc-100 sm:text-[15px]">{chapter.title}</span>
								<div class="flex items-center gap-3">
									{#if chapter.date}
										<span class="text-xs text-zinc-500">{chapter.date}</span>
									{/if}
									<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-zinc-500"><path d="m9 18 6-6-6-6"/></svg>
								</div>
							</a>
						{/each}
					</div>
				{:else}
					<div class="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
						{#each chapters as chapter}
							<a
								href="/read/{source}{chapter.id}"
								class="overflow-hidden rounded-xl border border-white/10 bg-black/30 text-center transition hover:border-white/25"
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
				<p class="py-10 text-center text-sm text-zinc-500">Belum ada chapter.</p>
			{/if}
		</div>
	</div>
</div>
