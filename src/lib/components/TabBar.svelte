<script lang="ts">
  import ChevronLeft from "@lucide/svelte/icons/chevron-left";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import { tabsStore } from "../stores/tabs.svelte";
  import { appConfig } from "../../config/app.config";
  import { getTabDefaultWidthPx, getTabMinWidthPx, getTabArrowWidthPx } from "../../config/css-tokens";
  import { t } from "../../i18n";
  import Tab from "./Tab.svelte";

  let barEl: HTMLDivElement | undefined = $state();
  let stripEl: HTMLDivElement | undefined = $state();
  let barWidth = $state(0);
  let hasOverflow = $state(false);
  let canScrollLeft = $state(false);
  let canScrollRight = $state(false);

  let resizing: { id: string; startX: number; startWidth: number } | null = null;
  let reordering: { id: string; startX: number; started: boolean } | null = null;
  let repeatTimer: ReturnType<typeof setInterval> | undefined;
  let draggingId = $state<string | null>(null);

  // Tolerancia de subpíxel al comparar scrollLeft con sus extremos (algunos
  // navegadores redondean el scroll fraccionario).
  const SCROLL_EDGE_FUZZ_PX = 0.5;
  const ARROW_COUNT = 2;

  function measure(): void {
    if (!stripEl) return;
    hasOverflow = stripEl.scrollWidth > stripEl.clientWidth + 1;
    updateScrollButtons();
  }

  function updateScrollButtons(): void {
    if (!stripEl) return;
    canScrollLeft = stripEl.scrollLeft > SCROLL_EDGE_FUZZ_PX;
    canScrollRight = stripEl.scrollLeft < stripEl.scrollWidth - stripEl.clientWidth - SCROLL_EDGE_FUZZ_PX;
  }

  // TAB-014: único mecanismo permitido para medir el ancho disponible
  // (ADR-012 COORD-005 — nunca window.innerWidth).
  $effect(() => {
    if (!barEl) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) barWidth = entry.contentRect.width;
      measure();
    });
    observer.observe(barEl);
    return () => observer.disconnect();
  });

  // Vuelve a medir cuando cambia el número de pestañas o algún ancho.
  $effect(() => {
    const widths = tabsStore.tabs.map((tab) => tab.width);
    void widths.length;
    measure();
  });

  // TAB-023: al activar una pestaña, el carril se desplaza para mostrarla completa.
  $effect(() => {
    const id = tabsStore.activeId;
    if (!id || !stripEl) return;
    const el = stripEl.querySelector<HTMLElement>(`[data-tab-id="${id}"]`);
    el?.scrollIntoView({ block: "nearest", inline: "nearest" });
  });

  function handleRailDblClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) tabsStore.newTab();
  }

  // TAB-022: rueda / gesto horizontal del trackpad desplaza el carril.
  function handleWheel(event: WheelEvent): void {
    if (!stripEl) return;
    event.preventDefault();
    stripEl.scrollLeft += event.deltaX !== 0 ? event.deltaX : event.deltaY;
  }

  // TAB-021: clic en flecha avanza exactamente una pestaña (la siguiente
  // parcialmente oculta pasa a ser totalmente visible).
  function scrollByOneTab(direction: 1 | -1): void {
    if (!stripEl) return;
    const containerRect = stripEl.getBoundingClientRect();
    const children = [...stripEl.children] as HTMLElement[];
    if (direction === 1) {
      const target = children.find((c) => c.getBoundingClientRect().right > containerRect.right + 1);
      if (target) stripEl.scrollLeft += target.getBoundingClientRect().right - containerRect.right;
    } else {
      const target = [...children].reverse().find((c) => c.getBoundingClientRect().left < containerRect.left - 1);
      if (target) stripEl.scrollLeft -= containerRect.left - target.getBoundingClientRect().left;
    }
  }

  function startArrowRepeat(direction: 1 | -1): void {
    scrollByOneTab(direction);
    repeatTimer = setInterval(() => scrollByOneTab(direction), appConfig.behavior.tabScrollRepeatMs);
  }

  function stopArrowRepeat(): void {
    clearInterval(repeatTimer);
    repeatTimer = undefined;
  }

  // TAB-011/012: arrastrar el borde derecho de una pestaña la redimensiona.
  // maxW = W_avail − arrowsW − (visibleOthers >= 1 ? --tab-min-w : 0).
  function computeMaxWidth(): number {
    const arrowsW = hasOverflow ? ARROW_COUNT * getTabArrowWidthPx() : 0;
    const visibleOthers = tabsStore.tabs.length - 1;
    return barWidth - arrowsW - (visibleOthers >= 1 ? getTabMinWidthPx() : 0);
  }

  function handleResizePointerMove(event: PointerEvent): void {
    if (!resizing) return;
    const deltaX = event.clientX - resizing.startX;
    const min = getTabMinWidthPx();
    const max = Math.max(min, computeMaxWidth());
    const next = Math.min(max, Math.max(min, resizing.startWidth + deltaX));
    tabsStore.setWidth(resizing.id, next);
  }

  function stopResize(): void {
    resizing = null;
    window.removeEventListener("pointermove", handleResizePointerMove);
    window.removeEventListener("pointerup", stopResize);
  }

  function handleResizeStart(tab: { id: string; width: number | null }, event: PointerEvent): void {
    event.preventDefault();
    resizing = { id: tab.id, startX: event.clientX, startWidth: tab.width ?? getTabDefaultWidthPx() };
    window.addEventListener("pointermove", handleResizePointerMove);
    window.addEventListener("pointerup", stopResize);
  }

  // IN-025: arrastrar una pestaña horizontalmente la reordena (reordeno en
  // vivo al cruzar el punto medio de la vecina, estilo VS Code).
  function swallowNextClick(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    window.removeEventListener("click", swallowNextClick, true);
  }

  function handleReorderPointerMove(event: PointerEvent): void {
    if (!reordering || !stripEl) return;
    const deltaX = event.clientX - reordering.startX;
    if (!reordering.started) {
      if (Math.abs(deltaX) < appConfig.behavior.tabDragThresholdPx) return;
      reordering.started = true;
      draggingId = reordering.id;
    }
    const children = [...stripEl.children] as HTMLElement[];
    const hoverIndex = children.findIndex((c) => {
      const rect = c.getBoundingClientRect();
      return event.clientX >= rect.left && event.clientX < rect.right;
    });
    if (hoverIndex === -1) return;
    tabsStore.reorder(reordering.id, hoverIndex);
  }

  function stopReorder(): void {
    if (reordering?.started) window.addEventListener("click", swallowNextClick, true);
    reordering = null;
    draggingId = null;
    window.removeEventListener("pointermove", handleReorderPointerMove);
    window.removeEventListener("pointerup", stopReorder);
  }

  function handleReorderStart(tab: { id: string }, event: PointerEvent): void {
    reordering = { id: tab.id, startX: event.clientX, started: false };
    window.addEventListener("pointermove", handleReorderPointerMove);
    window.addEventListener("pointerup", stopReorder);
  }
</script>

<div class="tab-bar" bind:this={barEl}>
  {#if hasOverflow}
    <button
      type="button"
      class="tab-arrow"
      aria-label={t("tab.scrollLeft")}
      disabled={!canScrollLeft}
      onpointerdown={() => startArrowRepeat(-1)}
      onpointerup={stopArrowRepeat}
      onpointerleave={stopArrowRepeat}
    >
      <ChevronLeft class="tab-arrow-icon" aria-hidden="true" />
    </button>
  {/if}
  <!-- TAB-033: atajo de mouse redundante — Nuevo (Mod+N) ya es el
       equivalente accesible por teclado, ver Dock.svelte -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="tab-strip" bind:this={stripEl} ondblclick={handleRailDblClick} onwheel={handleWheel} onscroll={updateScrollButtons}>
    {#each tabsStore.tabs as tab (tab.id)}
      <Tab
        {tab}
        active={tab.id === tabsStore.activeId}
        dragging={tab.id === draggingId}
        onActivate={() => tabsStore.activate(tab.id)}
        onClose={() => tabsStore.close(tab.id)}
        onResizeStart={(event) => handleResizeStart(tab, event)}
        onReorderStart={(event) => handleReorderStart(tab, event)}
      />
    {/each}
  </div>
  {#if hasOverflow}
    <button
      type="button"
      class="tab-arrow"
      aria-label={t("tab.scrollRight")}
      disabled={!canScrollRight}
      onpointerdown={() => startArrowRepeat(1)}
      onpointerup={stopArrowRepeat}
      onpointerleave={stopArrowRepeat}
    >
      <ChevronRight class="tab-arrow-icon" aria-hidden="true" />
    </button>
  {/if}
</div>

<style>
  .tab-bar {
    box-sizing: border-box;
    display: flex;
    height: var(--tabbar-h);
    background: var(--c-bg-elev);
    border-top: var(--border-w) solid var(--c-border);
  }

  .tab-strip {
    display: flex;
    flex: 1;
    overflow: auto hidden;
    scrollbar-width: none;
  }

  .tab-strip::-webkit-scrollbar {
    display: none;
  }

  .tab-arrow {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: var(--tab-arrow-w);
    height: 100%;
    border: none;
    background: var(--c-bg-elev);
    color: var(--c-text-muted);
    cursor: pointer;
  }

  .tab-arrow:disabled {
    color: var(--c-text-muted);
    cursor: default;
    opacity: 0.4;
  }

  .tab-arrow:focus-visible {
    outline: var(--focus-ring);
    outline-offset: calc(var(--focus-ring-offset) * -1);
  }

  .tab-arrow:hover:not(:disabled) {
    background: var(--c-bg-hover);
  }

  :global(.tab-arrow-icon) {
    width: var(--icon-size);
    height: var(--icon-size);
  }
</style>
