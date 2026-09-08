<script lang="ts">
	import type { PageData } from './$types';
	import { BookOpen, Bookmark, ChevronRight, Clock, Tag, User } from 'lucide-svelte';
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
	<meta name="description" content={manga.description?.slice(0, 160) || manga.title} />
</svelte:head>

<!-- Container gaya Mikoroku (mobile-first, max 480px di tengah opsional; di sini full lebar app) -->
<div class="relative min-h-[70vh] overflow-hidden rounded-2xl border border-zinc-800/60 bg-zinc-950">
	<!-- Blurred cover background -->
	{#if manga.cover}
		<div
			class="pointer-events-none absolute inset-0 scale-105 bg-cover bg-center opacity-40 blur-md"
			style="background-image: url('{proxyImage(manga.cover)}')"
		></div>
		<div class="absolute inset-0 bg-zinc-950/70"></div>
	{/if}

	<div class="relative z-10 px-4 py-5 sm:px-6">
		<!-- Header: cover + info -->
		<div class="mb-5 flex gap-4">
			<!-- Cover -->
			<div class="w-[90px] shrink-0 overflow-hidden rounded-xl shadow-lg shadow-black/40 sm:w-28">
				<div class="aspect-[2/3] bg-zinc-900">
					{#if manga.cover}
						<img
							src={proxyImage(manga.cover)}
							alt="{manga.title} cover"
							class="h-full w-full object-cover"
							loading="eager"
						/>
					{:else}
						<div class="flex h-full items-center justify-center text-zinc-600">
							<BookOpen class="h-8 w-8" />
						</div>
					{/if}
				</div>
			</div>

			<!-- Info -->
			<div class="min-w-0 flex-1">
				<h1 class="text-base font-bold leading-snug text-white sm:text-xl">
					{manga.title}
				</h1>

				<div class="mt-2 space-y-1.5 text-[11px] text-zinc-300 sm:text-xs">
					{#if manga.authors?.length}
						<div class="flex items-center gap-1.5">
							<User class="h-3.5 w-3.5 text-zinc-500" />
							<span class="truncate">{manga.authors.join(', ')}</span>
						</div>
					{/if}

					<div class="flex items-center gap-1.5">
						<Clock class="h-3.5 w-3.5 text-zinc-500" />
						<span class={statusClass(manga.status)}>{manga.status || 'Unknown'}</span>
					</div>

					{#if manga.chapters?.length}
						<div class="flex items-center gap-1.5 text-zinc-400">
							<BookOpen class="h-3.5 w-3.5 text-zinc-500" />
							<span>{manga.chapters.length} chapter</span>
						</div>
					{/if}
				</div>

				<!-- Actions -->
				<div class="mt-3 flex flex-wrap gap-2">
					{#if lastRead}
						<a
							href="/read/{source}{lastRead.chapterId}"
							class="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-xs font-semibold text-white"
						>
							<BookOpen class="h-3.5 w-3.5" />
							Lanjut baca
						</a>
					{:else if chapters[0]}
						<a
							href="/read/{source}{chapters[chapters.length - 1].id}"
							class="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-xs font-semibold text-white"
						>
							<BookOpen class="h-3.5 w-3.5" />
							Baca
						</a>
					{/if}

					<button
						type="button"
						class="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-1.5 text-xs text-zinc-300"
						title="Bookmark (hubungkan ke store kamu)"
					>
						<Bookmark class="h-3.5 w-3.5" />
						Bookmark
					</button>
				</div>
			</div>
		</div>

		<!-- Genres -->
		{#if manga.genres?.length}
			<div class="mb-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
				{#each manga.genres as genre}
					<span
						class="truncate rounded-lg border border-zinc-700/80 bg-black/30 px-2 py-1.5 text-center text-[10px] text-zinc-200 sm:text-[11px]"
						title={genre}
					>
						{genre}
					</span>
				{/each}
			</div>
		{/if}

		<!-- Synopsis -->
		{#if manga.description}
			<section class="mb-5 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3.5">
				<h2 class="mb-2 text-sm font-semibold text-white">Sinopsis</h2>
				<p class="text-xs leading-relaxed text-zinc-300 whitespace-pre-line">
					{manga.description}
				</p>
			</section>
		{/if}

		<!-- Chapter header tools -->
		<div class="mb-3 flex items-center justify-between gap-2">
			<h2 class="text-sm font-semibold text-white">
				Chapter
				<span class="font-normal text-zinc-500">({chapters.length})</span>
			</h2>

			<div class="flex items-center gap-1.5">
				<button
					type="button"
					class="rounded-lg border px-2.5 py-1.5 text-[10px] {sortNewest
						? 'border-fuchsia-500/50 bg-fuchsia-500/20 text-fuchsia-200'
						: 'border-amber-500/50 bg-amber-500/20 text-amber-200'}"
					onclick={() => (sortNewest = !sortNewest)}
				>
					{sortNewest ? 'Terbaru' : 'Terlama'}
				</button>

				<button
					type="button"
					class="rounded-lg border border-zinc-700 bg-zinc-900/50 px-2.5 py-1.5 text-[10px] text-zinc-300"
					onclick={() => (viewMode = viewMode === 'list' ? 'grid' : 'list')}
				>
					{viewMode === 'list' ? 'Grid' : 'List'}
				</button>
			</div>
		</div>

		<!-- Chapters -->
		{#if chapters.length}
			{#if viewMode === 'list'}
				<div class="space-y-1.5 pb-6">
					{#each chapters as chapter}
						<a
							href="/read/{source}{chapter.id}"
							class="group flex items-center justify-between rounded-xl border border-zinc-800/80 bg-zinc-900/50 px-3.5 py-3 transition hover:border-zinc-700 hover:bg-zinc-800/50"
						>
							<span class="text-sm text-zinc-200 group-hover:text-white">
								{chapter.title}
							</span>
							<div class="flex items-center gap-2">
								{#if chapter.date}
									<span class="text-[10px] text-zinc-500">{chapter.date}</span>
								{/if}
								<ChevronRight class="h-4 w-4 text-zinc-600 group-hover:text-[var(--color-primary)]" />
							</div>
						</a>
					{/each}
				</div>
			{:else}
				<div class="grid grid-cols-3 gap-2 pb-6 sm:grid-cols-4">
					{#each chapters as chapter}
						<a
							href="/read/{source}{chapter.id}"
							class="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/60 text-center transition hover:border-zinc-600"
						>
							<div class="aspect-square bg-zinc-800/80 p-2 flex items-center justify-center">
								<span class="text-xs font-semibold text-zinc-200 line-clamp-3 px-1">
									{chapter.title}
								</span>
							</div>
							{#if chapter.date}
								<div class="border-t border-zinc-800 px-1 py-1 text-[9px] text-zinc-500">
									{chapter.date}
								</div>
							{/if}
						</a>
					{/each}
				</div>
			{/if}
		{:else}
			<p class="py-10 text-center text-sm text-zinc-500">Belum ada chapter.</p>
		{/if}
	</div>
</div>
