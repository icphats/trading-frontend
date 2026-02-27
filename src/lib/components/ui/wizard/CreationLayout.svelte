<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    breadcrumb?: Snippet;
    header?: Snippet;
    steps?: Snippet;
    content?: Snippet;
  }

  let { breadcrumb, header, steps, content }: Props = $props();
</script>

<div class="creation-layout">
  <!-- Breadcrumb -->
  {#if breadcrumb}
    <div class="breadcrumb-container">
      {@render breadcrumb()}
    </div>
  {/if}

  <!-- Header -->
  {#if header}
    <div class="header-container">
      {@render header()}
    </div>
  {/if}

  <!-- Two Column Layout (desktop) / Single column (mobile) -->
  <div class="main-layout">
    <!-- Left: Step Indicator (contains both mobile header + desktop sidebar) -->
    {#if steps}
      {@render steps()}
    {/if}

    <!-- Right: Main Content -->
    {#if content}
      <div class="content-container">
        {@render content()}
      </div>
    {/if}
  </div>
</div>

<style>
  /* Note: Container styling (max-width, padding) inherited from parent +layout.svelte */
  .creation-layout {
    width: 100%;
  }

  .breadcrumb-container {
    margin-bottom: 16px;
  }

  .header-container {
    margin-bottom: 32px;
  }

  @media (max-width: 1024px) {
    .header-container {
      margin-bottom: 16px;
    }
  }

  .main-layout {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    gap: 20px;
    justify-content: flex-start;
    width: 100%;
  }

  @media (max-width: 1023px) {
    .main-layout {
      flex-direction: column;
    }
  }

  .content-container {
    flex: 1;
    max-width: 720px;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  @media (max-width: 1023px) {
    .content-container {
      max-width: 100%;
      order: 1;
    }
  }
</style>
