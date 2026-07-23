<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Search, ChevronDown, Check, X } from '@lucide/svelte';
	import Tooltip from './Tooltip.svelte';

	interface Option {
		value: string;
		label: string;
	}

	interface Props {
		label?: string;
		options?: Option[];
		value?: string;
		placeholder?: string;
		searchable?: boolean;
		fuzzy?: boolean;
		disabled?: boolean;
		onchange?: (value: string) => void;
		children?: Snippet;
	}

	let {
		label,
		options = [],
		value = $bindable(''),
		placeholder = 'Selecciona una opción',
		searchable = true,
		fuzzy = false,
		disabled = false,
		onchange,
		children
	}: Props = $props();

	let isOpen = $state(false);
	let searchQuery = $state('');
	let triggerElement: HTMLDivElement | null = null;
	let dropdownTop = $state(0);
	let dropdownLeft = $state(0);
	let dropdownWidth = $state(0);
	let dropdownMinWidth = $state(0);
	let dropdownMaxHeight = $state(240);
	let removePositionListeners: (() => void) | null = null;

	const uid = $props.id();

	const filteredOptions = $derived.by((): Option[] => {
		const query = searchQuery.trim().toLowerCase();
		if (query === '') return options;

		if (fuzzy) {
			const tokens = query.split(/\s+/).filter(Boolean);
			const scored = options
				.map((opt) => {
					const label = opt.label.toLowerCase();
					let score = 0;
					for (const token of tokens) {
						const idx = label.indexOf(token);
						if (idx === -1) return null;
						const prev = label[idx - 1];
						score += idx === 0 || !/[a-z0-9]/.test(prev) ? 2 : 1;
					}
					return { opt, score };
				})
				.filter((entry): entry is { opt: Option; score: number } => entry !== null)
				.sort((a, b) => b.score - a.score || a.opt.label.localeCompare(b.opt.label));
			return scored.map((entry) => entry.opt);
		}

		return options.filter((opt) => opt.label.toLowerCase().includes(query));
	});

	const selectedOption = $derived(options.find((opt) => opt.value === value) || null);

	function toggleDropdown() {
		if (!disabled) {
			isOpen = !isOpen;
			if (isOpen) {
				searchQuery = '';
				updateDropdownPosition();
				setupPositionListeners();
			} else {
				teardownPositionListeners();
			}
		}
	}

	function updateDropdownPosition() {
		if (!triggerElement || typeof window === 'undefined') return;

		const rect = triggerElement.getBoundingClientRect();
		const gap = 4;
		const viewportPadding = 8;
		const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
		const maxWidth = window.innerWidth - viewportPadding * 2;
		const width = Math.min(rect.width, maxWidth);

		dropdownTop = rect.bottom + gap;
		dropdownLeft = Math.min(
			Math.max(viewportPadding, rect.left),
			Math.max(viewportPadding, window.innerWidth - viewportPadding - width)
		);
		dropdownWidth = width;
		dropdownMinWidth = Math.max(width, width + 120);
		dropdownMaxHeight = Math.max(0, spaceBelow);
	}

	function setTriggerElement(element: HTMLDivElement) {
		triggerElement = element;

		return () => {
			if (triggerElement === element) {
				triggerElement = null;
				teardownPositionListeners();
			}
		};
	}

	function getScrollableAncestors(element: HTMLElement) {
		const parents: Array<HTMLElement | Window> = [window];
		let parent = element.parentElement;

		while (parent) {
			const style = getComputedStyle(parent);
			const overflow = `${style.overflow}${style.overflowX}${style.overflowY}`;

			if (/(auto|scroll|overlay)/.test(overflow)) {
				parents.push(parent);
			}

			parent = parent.parentElement;
		}

		return parents;
	}

	function setupPositionListeners() {
		teardownPositionListeners();

		if (!triggerElement || typeof window === 'undefined') return;

		const parents = getScrollableAncestors(triggerElement);
		const handler = () => updateDropdownPosition();

		parents.forEach((parent) => parent.addEventListener('scroll', handler, { passive: true }));
		window.addEventListener('resize', handler);

		removePositionListeners = () => {
			parents.forEach((parent) => parent.removeEventListener('scroll', handler));
			window.removeEventListener('resize', handler);
		};
	}

	function teardownPositionListeners() {
		removePositionListeners?.();
		removePositionListeners = null;
	}

	function handleDocumentClick(e: MouseEvent) {
		const target = e.target;

		if (!(target instanceof Element)) return;

		if (!target.closest(`#${uid}`)) {
			isOpen = false;
			searchQuery = '';
			teardownPositionListeners();
		}
	}

	function selectOption(opt: Option) {
		value = opt.value;
		isOpen = false;
		searchQuery = '';
		teardownPositionListeners();
		onchange?.(opt.value);
	}

	function clearSelection() {
		value = '';
		isOpen = false;
		searchQuery = '';
		teardownPositionListeners();
		onchange?.('');
	}
</script>

<svelte:document onclick={isOpen ? handleDocumentClick : undefined} />

<div id={uid} class="flex w-full flex-col gap-1.5">
	{#if label}
		<span
			id="{uid}-label"
			class="text-[11px] font-medium tracking-[0.12em] text-[#707070] uppercase"
		>
			{label}
		</span>
	{/if}
	<div class="relative w-full" {@attach setTriggerElement}>
		<div
			role="combobox"
			id="{uid}-combobox"
			tabindex="0"
			aria-labelledby={label ? `${uid}-label` : undefined}
			aria-expanded={isOpen}
			aria-controls="{uid}-listbox"
			onclick={toggleDropdown}
			onkeydown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					toggleDropdown();
				}
			}}
			class="flex h-9 w-full cursor-pointer items-center justify-between rounded-md border border-[#dfdfdf] bg-white px-3 py-2 text-sm text-[#171717] transition-colors duration-200 focus-visible:border-[#24b47e] focus-visible:ring-2 focus-visible:ring-[#3ecf8e]/35 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
			class:bg-[#fafafa]={isOpen}
		>
			<Tooltip content={selectedOption?.label} placement="top" triggerClass="flex min-w-0">
				<span class="truncate" class:text-[#9a9a9a]={!selectedOption}>
					{selectedOption ? selectedOption.label : placeholder}
				</span>
			</Tooltip>
			<div class="flex items-center gap-1">
				{#if value && !disabled}
					<span
						role="button"
						tabindex="0"
						onclick={(e) => {
							e.stopPropagation();
							clearSelection();
						}}
						onkeydown={(e) => {
							if (e.key === 'Enter') {
								e.stopPropagation();
								clearSelection();
							}
						}}
						class="flex h-4 w-4 cursor-pointer items-center justify-center rounded-full text-[#707070] hover:bg-[#ededed] hover:text-[#171717]"
					>
						<X class="h-3 w-3" />
					</span>
				{/if}
				<span class="transition-transform duration-200" class:rotate-180={isOpen}>
					<ChevronDown class="h-4 w-4 text-[#707070]" />
				</span>
			</div>
		</div>

		{#if isOpen}
			<div
				id="{uid}-listbox"
				class="fixed z-200 flex max-w-[calc(100vw-16px)] flex-col overflow-hidden rounded-xl border border-[#dfdfdf] bg-white text-[#171717] shadow-[0_8px_24px_rgba(0,0,0,0.08)]"
				style={`top: ${dropdownTop}px; left: ${dropdownLeft}px; width: ${dropdownWidth}px; min-width: ${dropdownMinWidth}px; max-height: ${dropdownMaxHeight}px;`}
				role="listbox"
			>
				{#if searchable}
					<div class="border-b border-[#ededed] bg-[#fafafa] p-3">
						<div
							class="flex h-9 items-center gap-2 rounded-md border border-[#dfdfdf] bg-white px-3 transition-colors duration-200 focus-within:border-[#24b47e] focus-within:ring-2 focus-within:ring-[#3ecf8e]/35"
						>
							<Search class="h-4 w-4 text-[#707070]" />
							<input
								type="text"
								bind:value={searchQuery}
								placeholder="Buscar..."
								class="w-full appearance-none border-0 bg-transparent p-0 text-sm text-[#171717] shadow-none placeholder:text-[#9a9a9a] focus:border-0 focus:ring-0 focus:outline-none focus-visible:outline-none"
								autocomplete="off"
							/>
						</div>
					</div>
				{/if}

				<div class="min-h-0 flex-1 overflow-y-auto p-1">
					{#if filteredOptions.length === 0}
						<div class="px-3 py-3 text-sm text-[#707070]">No se encontraron resultados</div>
					{:else}
						{#each filteredOptions as opt (opt.value)}
							<button
								type="button"
								onclick={() => selectOption(opt)}
								class="flex w-full items-center justify-between rounded-md px-3 py-2.5 text-sm transition-colors duration-150 hover:bg-[#fafafa]"
								class:bg-[#fafafa]={opt.value === value}
								class:font-medium={opt.value === value}
								role="option"
								aria-selected={opt.value === value}
							>
								<span class="truncate">{opt.label}</span>
								{#if opt.value === value}
									<Check class="h-4 w-4 text-[#3ecf8e]" />
								{/if}
							</button>
						{/each}
					{/if}
				</div>

				{#if children}
					<div class="border-t border-[#ededed]">
						{@render children()}
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>
