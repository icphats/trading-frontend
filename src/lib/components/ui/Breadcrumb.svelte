<script lang="ts">
  interface BreadcrumbItem {
    label: string;
    href?: string;
    active?: boolean;
  }

  let { items }: { items: BreadcrumbItem[] } = $props();
</script>

<nav aria-label="Breadcrumb">
  <ol class="flex items-center gap-2 text-sm">
    {#each items as item, index}
      <li class="flex items-center gap-2">
        {#if item.href && !item.active}
          <a
            href={item.href}
            class="text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] transition-colors"
          >
            {item.label}
          </a>
        {:else}
          <span
            class="font-medium"
            class:text-[color:var(--foreground)]={item.active}
            class:text-[color:var(--muted-foreground)]={!item.active}
          >
            {item.label}
          </span>
        {/if}

        {#if index < items.length - 1}
          <svg class="w-4 h-4 text-[color:var(--muted-foreground)]" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
          </svg>
        {/if}
      </li>
    {/each}
  </ol>
</nav>
