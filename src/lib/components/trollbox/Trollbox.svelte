<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { Trollbox } from "$lib/domain/trollbox";
  import { canisterIds } from "$lib/constants/app.constants";
  import MessageContent from "./MessageContent.svelte";
  import MemeSelector from "./MemeSelector.svelte";
  import MemeAutocomplete from "./MemeAutocomplete.svelte";
  import { getMemeAutocompleteContext, type Meme } from "$lib/domain/trollbox";
  import { toastState } from "$lib/state/portal/toast.state.svelte";
  import { app } from "$lib/state/app.state.svelte";
  import { user } from "$lib/domain/user/auth.svelte";

  const trollbox = new Trollbox(canisterIds.trollbox!);

  // Refs
  let inputRef = $state<HTMLTextAreaElement>();
  let messagesContainerRef = $state<HTMLDivElement>();
  let autocompleteRef = $state<any>();

  // Meme autocomplete state
  let autocompleteVisible = $state(false);
  let autocompletePartial = $state("");
  let autocompleteStartIndex = $state(0);

  // Username popover state
  let showUsernamePopover = $state(false);

  // Auto-scroll to bottom when new messages arrive
  $effect(() => {
    if (messagesContainerRef && trollbox.messagesArray.length > 0) {
      messagesContainerRef.scrollTop = messagesContainerRef.scrollHeight;
    }
  });

  // Handle input changes for autocomplete
  function handleInput(e: Event) {
    const target = e.target as HTMLTextAreaElement;
    const context = getMemeAutocompleteContext(target.value, target.selectionStart ?? 0);

    if (context) {
      autocompleteVisible = true;
      autocompletePartial = context.partial;
      autocompleteStartIndex = context.startIndex;
    } else {
      autocompleteVisible = false;
    }
  }

  // Handle keyboard events for autocomplete
  function handleKeyDown(e: KeyboardEvent) {
    if (autocompleteVisible && autocompleteRef) {
      const handled = autocompleteRef.handleKeyDown(e);
      if (handled) {
        return;
      }
    }

    // Submit on Enter (without Shift)
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  // Insert meme from autocomplete (replaces the :partial typed so far)
  function insertMemeFromAutocomplete(meme: Meme) {
    const current = trollbox.chatForm.message;
    const before = current.slice(0, autocompleteStartIndex);
    const after = current.slice(autocompleteStartIndex + autocompletePartial.length);

    trollbox.setChatFormValues({
      message: `${before}${meme.shortcode} ${after}`,
    });

    autocompleteVisible = false;
    inputRef?.focus();
  }

  // Insert meme from MemeSelector button (inserts at cursor or end)
  function insertMemeAtCursor(meme: Meme) {
    const current = trollbox.chatForm.message;
    const pos = inputRef?.selectionStart ?? current.length;
    const before = current.slice(0, pos);
    const after = current.slice(pos);

    trollbox.setChatFormValues({
      message: `${before}${meme.shortcode} ${after}`,
    });

    inputRef?.focus();
  }

  // Handle form submission (non-blocking — optimistic UI)
  function handleSubmit() {
    if (!trollbox.chatForm.message.trim()) return;
    trollbox.submitChatMessage();
  }

  // Handle username submission from popover
  async function handleUsernameSubmit() {
    try {
      await trollbox.submitUsername();
      showUsernamePopover = false;
    } catch {
      // Error is set on trollbox.usernameForm.error
    }
  }

  // Format timestamp using app.now for reactive updates
  function formatTime(timestamp: bigint): string {
    const date = new Date(Number(timestamp));
    const diff = app.now.getTime() - date.getTime();

    if (diff < 5000) return "now";

    if (diff < 60000) {
      return `${Math.floor(diff / 1000)}s`;
    }

    if (diff < 3600000) {
      return `${Math.floor(diff / 60000)}m`;
    }

    if (diff < 86400000) {
      return `${Math.floor(diff / 3600000)}h`;
    }

    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  onMount(() => {
    trollbox.startPolling();
  });

  onDestroy(() => {
    trollbox.stopPolling();
  });
</script>

<div class="trollbox-container">
  <!-- Chat Interface -->
  <div class="chat-interface">
    <!-- Messages Area -->
    <div class="messages-container" bind:this={messagesContainerRef}>
      {#if trollbox.messagesArray.length === 0}
        <div class="empty-state">
          <p>No messages yet. Be the first to say something!</p>
        </div>
      {:else}
        <div class="messages-list">
          {#each trollbox.messagesArray.slice().reverse() as message (message.id)}
            <div class="message" class:message-pending={message.status === 'pending'} class:message-failed={message.status === 'failed'}>
              <div class="message-header">
                <button
                  class="message-username"
                  onclick={() => {
                    if (message.author) {
                      navigator.clipboard.writeText(message.author);
                      toastState.show({ message: 'Principal copied', variant: 'success', duration: 1500 });
                    }
                  }}
                  title={message.author || undefined}
                >{message.username || (message.author ? message.author.slice(0, 10) : "Anonymous")}</button>
                <span class="message-time">
                  {#if message.status === 'failed'}
                    failed
                  {:else}
                    {formatTime(message.created_at)}
                  {/if}
                </span>
              </div>
              <div class="message-content">
                <MessageContent content={message.content} />
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Input Area -->
    <div class="input-container">
      <!-- Meme Autocomplete -->
      <MemeAutocomplete bind:this={autocompleteRef} partial={autocompletePartial} onSelectMeme={insertMemeFromAutocomplete} isVisible={autocompleteVisible} position={{ x: 0, y: 0 }} />

      <form
        onsubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
        class="chat-form"
      >
        <textarea
          bind:this={inputRef}
          class="message-input"
          placeholder="Type a message..."
          bind:value={trollbox.chatForm.message}
          oninput={handleInput}
          onkeydown={handleKeyDown}
          maxlength={Number(trollbox.maxMessageLength)}
          rows="1"
        ></textarea>

        <div class="input-toolbar">
          <div class="toolbar-left">
            <MemeSelector onSelectMeme={insertMemeAtCursor} searchTerm="" />

            <div class="username-popover-anchor">
              <button
                type="button"
                class="toolbar-icon-button"
                aria-label="Change username"
                onclick={() => { showUsernamePopover = !showUsernamePopover; if (showUsernamePopover) trollbox.setUsernameFormValues({ username: trollbox.myUsername ?? '' }); }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
              </button>

              {#if showUsernamePopover}
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div class="username-popover" onkeydown={(e) => { if (e.key === 'Escape') showUsernamePopover = false; }}>
                  <label class="popover-label" for="username-input">
                    {trollbox.myUsername ? 'Change username' : 'Set username'}
                  </label>
                  <div class="popover-row">
                    <input
                      id="username-input"
                      type="text"
                      class="popover-input"
                      placeholder="username"
                      bind:value={trollbox.usernameForm.username}
                      onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleUsernameSubmit(); } }}
                      disabled={trollbox.usernameForm.isSubmitting}
                    />
                    <button
                      type="button"
                      class="popover-save-button"
                      onclick={handleUsernameSubmit}
                      disabled={trollbox.usernameForm.isSubmitting || !trollbox.usernameForm.username.trim()}
                    >
                      {trollbox.usernameForm.isSubmitting ? '...' : 'Save'}
                    </button>
                  </div>
                  {#if trollbox.usernameForm.error}
                    <p class="popover-error">{trollbox.usernameForm.error}</p>
                  {/if}
                </div>
              {/if}
            </div>
          </div>

          {#if trollbox.chatForm.error}
            <p class="error-message">{trollbox.chatForm.error}</p>
          {/if}

          <div class="toolbar-right">
            <span class="char-counter">
              {trollbox.chatForm.message.length}/{trollbox.maxMessageLength}
            </span>
            <button type="submit" class="send-button" aria-label="Send message" disabled={!trollbox.chatForm.message.trim()}>
              <svg class="send-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
            </button>
          </div>
        </div>
      </form>
    </div>
  </div>
</div>

<style>
  .trollbox-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--background);
    overflow: hidden;
  }

  /* Chat Interface */
  .chat-interface {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .messages-container {
    flex: 1;
    overflow-y: auto;
    min-height: 0;
  }

  .empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--muted-foreground);
    font-size: 0.875rem;
  }

  .messages-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 12px;
  }

  .message {
    background: var(--field);
    border-radius: var(--radius-lg);
    padding: 10px 12px;
    transition: background 150ms ease;
  }

  .message:hover {
    background: var(--field-hover);
  }

  .message-pending {
    opacity: 0.6;
  }

  .message-failed {
    opacity: 0.8;
    border-left: 2px solid var(--destructive);
  }

  .message-failed .message-time {
    color: var(--destructive);
  }

  .message-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 4px;
    font-size: 0.75rem;
  }

  .message-username {
    color: var(--accent-foreground);
    font-weight: 600;
    background: none;
    border: none;
    padding: 0;
    font: inherit;
    font-size: inherit;
    cursor: pointer;
  }

  .message-username:hover {
    opacity: 0.7;
  }

  .message-time {
    color: var(--muted-foreground);
    font-size: 0.6875rem;
  }

  .message-content {
    color: var(--foreground);
    font-size: 0.875rem;
    line-height: 1.5;
    word-wrap: break-word;
  }

  /* Input Area */
  .input-container {
    position: relative;
    border-top: 1px solid var(--border);
    background: var(--background);
  }

  .chat-form {
    width: 100%;
  }

  .message-input {
    display: block;
    width: 100%;
    background: transparent;
    border: none;
    padding: 14px 16px 8px;
    color: var(--foreground);
    font-size: 16px;
    font-family: var(--font-sans);
    font-weight: var(--font-weight-book, 485);
    resize: none;
    min-height: 44px;
    max-height: 120px;
    line-height: 1.4;
    outline: none;
  }

  .message-input::placeholder {
    color: var(--muted-foreground);
  }

  .message-input:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .input-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 12px 8px;
  }

  .toolbar-right {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .char-counter {
    color: var(--muted-foreground);
    font-size: 11px;
    font-family: var(--font-sans);
  }

  .send-button {
    background: var(--primary);
    border: none;
    border-radius: var(--radius-lg);
    width: 30px;
    height: 30px;
    color: var(--primary-foreground);
    cursor: pointer;
    transition: opacity 150ms ease, transform 100ms ease;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .send-icon {
    width: 14px;
    height: 14px;
  }

  .send-button:hover:not(:disabled) {
    opacity: 0.85;
  }

  .send-button:active:not(:disabled) {
    transform: scale(0.92);
  }

  .send-button:disabled {
    opacity: 0.25;
    cursor: not-allowed;
  }

  .error-message {
    color: var(--destructive);
    font-size: 11px;
    margin: 0;
    font-family: var(--font-sans);
  }

  .toolbar-left {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .toolbar-icon-button {
    background: none;
    border: none;
    color: var(--muted-foreground);
    cursor: pointer;
    padding: 4px;
    border-radius: var(--radius-sm);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 150ms ease;
  }

  .toolbar-icon-button:hover {
    color: var(--foreground);
  }

  /* Username Popover */
  .username-popover-anchor {
    position: relative;
  }

  .username-popover {
    position: absolute;
    bottom: calc(100% + 8px);
    left: 0;
    background: var(--popover);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 12px;
    min-width: 220px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 10;
  }

  .popover-label {
    display: block;
    font-size: 12px;
    font-weight: 500;
    color: var(--muted-foreground);
    margin-bottom: 8px;
  }

  .popover-row {
    display: flex;
    gap: 6px;
  }

  .popover-input {
    flex: 1;
    min-width: 0;
    padding: 6px 10px;
    font-size: 13px;
    font-family: var(--font-sans);
    color: var(--foreground);
    background: var(--field);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    outline: none;
  }

  .popover-input:focus {
    border-color: var(--field-border);
  }

  .popover-input:disabled {
    opacity: 0.5;
  }

  .popover-save-button {
    padding: 6px 12px;
    font-size: 13px;
    font-weight: 500;
    font-family: var(--font-sans);
    color: var(--primary-foreground);
    background: var(--primary);
    border: none;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: opacity 150ms ease;
    white-space: nowrap;
  }

  .popover-save-button:hover:not(:disabled) {
    opacity: 0.85;
  }

  .popover-save-button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .popover-error {
    font-size: 11px;
    color: var(--destructive);
    margin: 6px 0 0;
  }
</style>
