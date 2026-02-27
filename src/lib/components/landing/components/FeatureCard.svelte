<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    href?: string;
    color?: string;
    title: string;
    subtitle: string;
    description: string;
    buttonText: string;
    icon?: Snippet;
    children?: Snippet;
  }

  let { href = '/trade', color = '#6366f1', title, subtitle, description, buttonText, icon, children }: Props = $props();
</script>

<a {href} class="feature-card" style="--card-color: {color};">
  <div class="card-content">
    <!-- Header with icon pill -->
    <div class="card-header">
      <div class="pill">
        {#if icon}
          {@render icon()}
        {/if}
        <span>{title}</span>
      </div>
    </div>

    <!-- Text content -->
    <h3 class="subtitle">{subtitle}</h3>
    <p class="description">{description}</p>

    <!-- CTA Button -->
    <div class="card-button">
      <span>{buttonText}</span>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M5 12h14M12 5l7 7-7 7"/>
      </svg>
    </div>
  </div>

  <!-- Optional custom content area -->
  {#if children}
    <div class="card-children">
      {@render children()}
    </div>
  {/if}
</a>

<style>
  .feature-card {
    position: relative;
    display: flex;
    flex-direction: column;
    width: 100%;
    min-height: 280px;
    border-radius: 24px;
    overflow: hidden;
    text-decoration: none;
    background: var(--card);
    transition: transform 0.2s ease, box-shadow 0.2s ease;
    cursor: pointer;
  }

  .feature-card:hover {
    transform: translateY(-4px);
    box-shadow: var(--shadow-lg);
  }

  .card-content {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 2rem;
    flex: 1;
  }

  .card-header {
    display: flex;
    align-items: center;
  }

  .pill {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: oklch(from var(--card-color) l c h / 0.15);
    border-radius: 20px;
    color: var(--card-color);
    font-size: 0.875rem;
    font-weight: 500;
  }

  .pill :global(svg) {
    width: 18px;
    height: 18px;
  }

  .subtitle {
    margin: 1rem 0 0 0;
    font-size: 1.75rem;
    font-weight: 500;
    line-height: 1.2;
    color: var(--card-color);
  }

  .description {
    margin: 0;
    font-size: 1.125rem;
    line-height: 1.5;
    color: var(--card-color);
    opacity: 0.8;
    flex: 1;
  }

  .card-button {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 1rem;
    padding: 0.625rem 1rem;
    background: var(--muted);
    border-radius: 20px;
    color: var(--foreground);
    font-size: 0.875rem;
    font-weight: 500;
    width: fit-content;
    transition: background 0.15s ease;
  }

  .feature-card:hover .card-button {
    background: var(--border);
  }

  .card-children {
    padding: 0 2rem 2rem;
  }

  /* Responsive */
  @media (max-width: 1024px) {
    .feature-card {
      min-height: 240px;
    }

    .card-content {
      padding: 1.5rem;
    }

    .subtitle {
      font-size: 1.5rem;
    }

    .description {
      font-size: 1rem;
    }

    .card-children {
      padding: 0 1.5rem 1.5rem;
    }
  }

  @media (max-width: 640px) {
    .feature-card {
      min-height: 200px;
    }

    .card-content {
      padding: 1.25rem;
    }

    .subtitle {
      font-size: 1.25rem;
    }

    .card-children {
      padding: 0 1.25rem 1.25rem;
    }
  }
</style>
