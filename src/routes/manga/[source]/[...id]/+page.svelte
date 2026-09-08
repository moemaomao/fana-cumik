<script lang="ts">
	import type { PageData } from './$types';

	const { data }: { data: PageData } = $props();
	let { manga, source } = $derived(data);

	let sortNewest = $state(true);
	// 4 Mode: 'grid-thumb' | 'grid-text' | 'list-thumb' | 'list-text'
	let viewMode = $state<'grid-thumb' | 'grid-text' | 'list-thumb' | 'list-text'>('grid-thumb');
	let activeServer = $state<'sv1' | 'sv2' | 'es'>('sv1');

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
			<!-- Header Info Manga -->
			<div class="flex flex-col gap-6 md:flex-row md:gap-8">
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

					<div class="flex items-center gap-1.5 text-sm font-semibold text-yellow-400">
						<div class="flex text-amber-400">
							{#each Array(5) as _, i}
								<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
							{/each}
						</div>
						<span class="text-xs text-zinc-300">8.2</span>
					</div>

					<button
						type="button"
						class="flex w-full items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 py-2.5 text-sm font-medium text-white transition hover:bg-white/20"
					>
						<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/></svg>
						Bookmark
					</button>
				</div>

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
								<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="mt-0.5 shrink-0 text-zinc-400"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 1 0 7.75"/></svg>
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

			{#if synopsis}
				<section class="mt-6 rounded-xl border border-white/10 bg-black/30 p-5">
					<h2 class="mb-3 text-lg font-semibold text-white">Synopsis</h2>
					<p class="text-sm leading-relaxed text-zinc-300 sm:text-[15px] whitespace-pre-line">
						{synopsis}
					</p>
				</section>
			{/if}

			<!-- Control Bar & Section Chapters -->
			<div class="mt-10 flex items-center gap-3">
				<!-- Server Selection Buttons (Sisi Kiri) -->
				<div class="flex items-center gap-1.5 shrink-0">
					<button
						type="button"
						title="Server 1 — Mikodrive"
						class="flex h-9 w-9 items-center justify-center rounded-xl border transition {activeServer === 'sv1' ? 'border-purple-500 bg-purple-600 text-white' : 'border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10'}"
						onclick={() => (activeServer = 'sv1')}
					>
						<div class="flex items-center gap-0.5">
							<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>
							<span class="text-[10px] font-bold">1</span>
						</div>
					</button>

					<button
						type="button"
						title="Server 2 — Yomidays"
						class="flex h-9 w-9 items-center justify-center rounded-xl border transition {activeServer === 'sv2' ? 'border-amber-500 bg-amber-500 text-white' : 'border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10'}"
						onclick={() => (activeServer = 'sv2')}
					>
						<div class="flex items-center gap-0.5">
							<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>
							<span class="text-[10px] font-bold">2</span>
						</div>
					</button>

					<button
						type="button"
						title="Emergency Server — Firestore"
						class="flex h-9 w-9 items-center justify-center rounded-xl border transition {activeServer === 'es' ? 'border-red-500 bg-red-500 text-white' : 'border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10'}"
						onclick={() => (activeServer = 'es')}
					>
						<div class="flex items-center gap-0.5">
							<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
							<span class="text-[9px] font-bold">ES</span>
						</div>
					</button>
				</div>

				<!-- Section Chapters (Tengah) -->
				<div class="flex flex-1 items-center gap-3">
					<div class="h-[1px] flex-1 bg-white/10"></div>
					<h2 class="text-sm font-semibold tracking-wide text-zinc-200 sm:text-base">
						Chapters
					</h2>
					<div class="h-[1px] flex-1 bg-white/10"></div>
				</div>

				<!-- Sort & View Controls (Sisi Kanan) -->
				<div class="flex items-center gap-1.5 shrink-0">
					<!-- Sort Button -->
					<button
						type="button"
						title="Urutkan Chapter"
						class="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10"
						onclick={() => (sortNewest = !sortNewest)}
					>
						<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="transition-transform {sortNewest ? '' : 'rotate-180'}"><path d="m3 16 4 4 4-4"/><path d="M7 20V4"/><path d="M11 4h10"/><path d="M11 8h7"/><path d="M11 12h4"/></svg>
					</button>

					<!-- 1. Grid dengan Thumbnail -->
					<button
						type="button"
						title="Grid dengan Thumbnail"
						class="flex h-9 w-9 items-center justify-center rounded-xl border transition {viewMode === 'grid-thumb' ? 'border-purple-500 bg-purple-600 text-white' : 'border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10'}"
						onclick={() => (viewMode = 'grid-thumb')}
					>
						<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 14l4-4 4 4"/><path d="M14 11l3-3 4 4"/><circle cx="8.5" cy="8.5" r="1.5"/></svg>
					</button>

					<!-- 2. Grid Tanpa Thumbnail (Mirip Screenshot) -->
					<button
						type="button"
						title="Grid Tanpa Thumbnail"
						class="flex h-9 w-9 items-center justify-center rounded-xl border transition {viewMode === 'grid-text' ? 'border-purple-500 bg-purple-600 text-white' : 'border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10'}"
						onclick={() => (viewMode = 'grid-text')}
					>
						<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>
					</button>

					<!-- 3. List dengan Thumbnail -->
					<button
						type="button"
						title="List dengan Thumbnail"
						class="flex h-9 w-9 items-center justify-center rounded-xl border transition {viewMode === 'list-thumb' ? 'border-purple-500 bg-purple-600 text-white' : 'border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10'}"
						onclick={() => (viewMode = 'list-thumb')}
					>
						<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="6" height="6" x="3" y="4" rx="1"/><rect width="6" height="6" x="3" y="14" rx="1"/><line x1="12" x2="21" y1="7" y2="7"/><line x1="12" x2="21" y1="17" y2="17"/></svg>
					</button>

					<!-- 4. List Tanpa Thumbnail (Compact) -->
					<button
						type="button"
						title="List Tanpa Thumbnail"
						class="flex h-9 w-9 items-center justify-center rounded-xl border transition {viewMode === 'list-text' ? 'border-purple-500 bg-purple-600 text-white' : 'border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10'}"
						onclick={() => (viewMode = 'list-text')}
					>
						<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/></svg>
					</button>
				</div>
			</div>

			<!-- Chapter Lists View -->
			{#if chapters.length}
				{#if viewMode === 'grid-thumb'}
					<!-- MODE 1: Grid dengan Thumbnail -->
					<div class="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
						{#each chapters as chapter}
							<a
								href="/read/{source}{chapter.id}?server={activeServer}"
								class="group flex flex-col overflow-hidden rounded-xl border border-white/10 bg-[#16162a]/80 transition hover:border-purple-500/50 hover:bg-[#1a1a32]"
							>
								<div class="aspect-[16/9] w-full overflow-hidden bg-zinc-900">
									{#if chapter.cover || manga.cover}
										<img
											src={proxyImage(chapter.cover || manga.cover)}
											alt={chapter.title}
											class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
										/>
									{/if}
								</div>
								<div class="flex flex-1 flex-col justify-between p-2.5">
									<div class="truncate text-xs font-bold text-white group-hover:text-purple-400">
										{chapter.title}
									</div>
									<div class="mt-1.5 flex items-center justify-between text-[10px] text-zinc-400">
										<span>{chapter.date || '20/01/2025'}</span>
										<span class="rounded bg-white/5 px-1.5 py-0.5 text-[9px] text-zinc-400">Exn</span>
									</div>
								</div>
							</a>
						{/each}
					</div>

				{:else if viewMode === 'grid-text'}
					<!-- MODE 2: Grid Tanpa Thumbnail (Sesuai SS) -->
					<div class="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
						{#each chapters as chapter}
							<a
								href="/read/{source}{chapter.id}?server={activeServer}"
								class="group flex flex-col justify-between rounded-lg border border-white/10 bg-[#16162a]/80 p-3 transition hover:border-purple-500/50 hover:bg-[#1a1a32]"
							>
								<div class="truncate text-xs font-bold text-white group-hover:text-purple-400">
									{chapter.title}
								</div>
								<div class="mt-2 flex items-center justify-between text-[10px] text-zinc-400">
									<span>{chapter.date || '20/01/2025'}</span>
									<span class="rounded bg-white/5 px-1.5 py-0.5 text-[9px] text-zinc-400">Exn</span>
								</div>
							</a>
						{/each}
					</div>

				{:else if viewMode === 'list-thumb'}
					<!-- MODE 3: List dengan Thumbnail -->
					<div class="mt-6 space-y-2.5">
						{#each chapters as chapter}
							<a
								href="/read/{source}{chapter.id}?server={activeServer}"
								class="group flex items-center gap-3 overflow-hidden rounded-xl border border-white/10 bg-[#16162a]/80 p-2 transition hover:border-purple-500/50 hover:bg-[#1a1a32]"
							>
								<div class="aspect-[16/10] w-24 shrink-0 overflow-hidden rounded-lg bg-zinc-900 sm:w-28">
									{#if chapter.cover || manga.cover}
										<img
											src={proxyImage(chapter.cover || manga.cover)}
											alt={chapter.title}
											class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
										/>
									{/if}
								</div>
								<div class="flex flex-1 items-center justify-between min-w-0 pr-2">
									<div>
										<p class="truncate text-xs font-bold text-white sm:text-sm group-hover:text-purple-400">
											{chapter.title}
										</p>
										<p class="mt-1 text-[10px] text-zinc-400 sm:text-xs">
											{chapter.date || '20/01/2025'}
										</p>
									</div>
									<span class="rounded bg-white/5 px-2 py-0.5 text-[10px] text-zinc-400">Exn</span>
								</div>
							</a>
						{/each}
					</div>

				{:else}
					<!-- MODE 4: List Tanpa Thumbnail (Compact List) -->
					<div class="mt-6 space-y-2">
						{#each chapters as chapter}
							<a
								href="/read/{source}{chapter.id}?server={activeServer}"
								class="flex items-center justify-between rounded-lg border border-white/10 bg-[#16162a]/80 px-4 py-3 transition hover:border-purple-500/50 hover:bg-[#1a1a32]"
							>
								<div class="min-w-0 pr-3">
									<p class="truncate text-sm font-semibold text-zinc-100">
										{chapter.title}
									</p>
									<p class="mt-0.5 text-[10px] text-zinc-400">{chapter.date || '20/01/2025'}</p>
								</div>
								<span class="rounded bg-white/5 px-2 py-0.5 text-xs text-zinc-400">Exn</span>
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
