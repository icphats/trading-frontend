<script lang="ts">
  import { app, type ThemeMode } from "$lib/state/app.state.svelte";

  let open = $state(false);

  function handleThemeChange(mode: ThemeMode) {
    app.setThemeMode(mode);
  }

  // Close when clicking outside
  $effect(() => {
    if (!open) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest(".preferences-wrapper")) {
        open = false;
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  });
</script>

<div class="preferences-wrapper">
  <button
    class="preferences-button"
    onclick={() => open = !open}
    aria-label="Preferences"
  >
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="1"></circle>
      <circle cx="19" cy="12" r="1"></circle>
      <circle cx="5" cy="12" r="1"></circle>
    </svg>
  </button>

  {#if open}
    <div class="dropdown-panel preferences-dropdown">
      <div class="preferences-header">Preferences</div>
      <div class="theme-section">
        <span class="theme-label">Theme</span>
        <div class="theme-toggle">
          <button
            class="theme-option"
            class:active={app.themeMode === 'system'}
            onclick={() => handleThemeChange('system')}
          >
            Auto
          </button>
          <button
            class="theme-option"
            class:active={app.themeMode === 'light'}
            onclick={() => handleThemeChange('light')}
            aria-label="Light theme"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="5"></circle>
              <line x1="12" y1="1" x2="12" y2="3"></line>
              <line x1="12" y1="21" x2="12" y2="23"></line>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
              <line x1="1" y1="12" x2="3" y2="12"></line>
              <line x1="21" y1="12" x2="23" y2="12"></line>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
            </svg>
          </button>
          <button
            class="theme-option"
            class:active={app.themeMode === 'dark'}
            onclick={() => handleThemeChange('dark')}
            aria-label="Dark theme"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
            </svg>
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .preferences-wrapper {
    position: relative;
  }

  .preferences-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    background: transparent;
    border: none;
    border-radius: 12px;
    cursor: pointer;
    color: var(--muted-foreground);
    transition: background-color 0.15s ease;
  }

  .preferences-button:hover {
    background: var(--muted);
    color: var(--foreground);
  }

  .preferences-dropdown {
    right: 0;
    min-width: 240px;
    padding: 12px;
  }

  .preferences-header {
    font-size: 14px;
    font-weight: 535;
    color: var(--foreground);
    padding-bottom: 12px;
    border-bottom: 1px solid var(--border);
    margin-bottom: 12px;
  }

  .theme-section {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 8px;
    gap: 16px;
  }

  .theme-label {
    font-size: 14px;
    font-weight: 485;
    color: var(--foreground);
  }

  .theme-toggle {
    display: flex;
    align-items: center;
    background: var(--muted);
    border-radius: 20px;
    padding: 4px;
    gap: 0;
  }

  .theme-option {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 32px;
    padding: 0 12px;
    background: transparent;
    border: none;
    border-radius: 16px;
    cursor: pointer;
    transition: all 0.1s ease;
    color: var(--muted-foreground);
    font-size: 14px;
    font-weight: 485;
  }

  .theme-option:hover:not(.active) {
    color: var(--foreground);
  }

  .theme-option.active {
    background: var(--background);
    color: var(--foreground);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
  }

  .theme-option svg {
    width: 20px;
    height: 20px;
  }
</style>
