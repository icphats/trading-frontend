/**
 * Trollbox State Management
 * Architecture Compliance: FRONTEND_ARCHITECTURE.md - Domain Layer
 */

import type { MessageResponse } from '$lib/actors/services/trollbox.service';
import type {
  TrollboxService,
  MessageId,
  Message,
  ChatFormState,
  UsernameFormState
} from './trollbox.types';
import { idlFactory as trollboxIDL } from 'declarations/trollbox/trollbox.did.js';
import { createActor } from '$lib/actors/create-actor';
import { toastState } from '$lib/state/portal/toast.state.svelte';
import { user } from '$lib/domain/user/auth.svelte';
import { SvelteMap } from 'svelte/reactivity';

// ============================================
// Exponential Backoff Configuration
// ============================================

const BACKOFF_CONFIG = {
  initialDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  multiplier: 2,
  maxRetries: 5
};

// Client-side message limits (not returned by backend)
const MAX_MESSAGE_LENGTH = 280;
const MIN_USERNAME_LENGTH = 4;
const MAX_USERNAME_LENGTH = 10;

// ============================================
// Trollbox Class
// ============================================

export class Trollbox {
  constructor(canister_id: string) {
    this.canister_id = canister_id;
    this.actor = createActor<TrollboxService>(trollboxIDL, canister_id);
  }

  canister_id!: string;
  actor: TrollboxService;

  // Expose limits for UI (char counter, etc.)
  readonly maxMessageLength = MAX_MESSAGE_LENGTH;

  // Client-side message buffer limit
  private readonly MAX_CLIENT_MESSAGES = 1000;

  // ============================================
  // Cursor-Based Polling State
  // ============================================

  // Last message ID for cursor-based polling
  private lastMessageId = $state<MessageId | null>(null);

  // User's username
  myUsername = $state<string | null>(null);

  // Messages state - using SvelteMap for reactivity
  messages = new SvelteMap<MessageId, Message>();

  // Messages as sorted array (derived)
  messagesArray = $derived.by(() => {
    return Array.from(this.messages.values()).sort((a, b) => {
      // Sort by timestamp descending (newest first)
      return Number(b.created_at - a.created_at);
    });
  });

  // Chat form state
  chatForm = $state<ChatFormState>({
    message: '',
    isSubmitting: false,
    error: null
  });

  // Username form state
  usernameForm = $state<UsernameFormState>({
    username: '',
    isSubmitting: false,
    error: null
  });

  // Polling timeout
  private pollingTimeout: ReturnType<typeof setTimeout> | null = null;

  // Exponential backoff state
  private backoffDelay = BACKOFF_CONFIG.initialDelay;
  private consecutiveFailures = 0;

  // Optimistic send tracking
  // Sends in flight — polling is paused while > 0 to prevent race conditions
  private pendingSends = 0;
  // Maps real message ID → temp map key, so polling skips messages we already display
  private sentRealToTempKey = new Map<bigint, bigint>();

  // ============================================
  // Initialization & Hydration
  // ============================================

  /**
   * Initialize data with single atomic hydration call
   * Called once on mount for optimal first paint
   */
  async hydrateAll(): Promise<void> {
    try {
      const hydration = await this.actor.get_hydration(100n);

      // Set my username
      this.myUsername = hydration.my_username.length > 0 ? hydration.my_username[0] ?? null : null;

      // Process initial messages and update cursor
      this.processMessages(hydration.messages);

      // Reset backoff on success
      this.resetBackoff();
    } catch (error) {
      console.error('Failed to hydrate trollbox data:', error);
      await this.handlePollingError('hydration');
      throw error;
    }
  }

  // ============================================
  // Cursor-Based Polling Methods
  // ============================================

  /**
   * Poll for new messages using cursor-based pagination
   * Called with fixed delay (500ms) for simplicity
   */
  private async pollNewMessages(): Promise<void> {
    // Skip poll while sends are in flight to avoid duplicate race
    if (this.pendingSends > 0) {
      this.scheduleNextPoll();
      return;
    }

    try {
      // Fetch messages - get latest batch
      const response = await this.actor.get_messages([], 100n);
      if (response.data.length > 0) {
        this.processMessages(response.data);
      }

      // Reset backoff on success
      this.resetBackoff();
    } catch (error) {
      console.error('Failed to poll trollbox messages:', error);
      await this.handlePollingError('polling');
    } finally {
      // Schedule next poll with fixed delay (500ms)
      this.scheduleNextPoll();
    }
  }

  /**
   * Schedule next poll with fixed delay (500ms)
   */
  private scheduleNextPoll(): void {
    this.pollingTimeout = setTimeout(() => this.pollNewMessages(), 500);
  }

  // ============================================
  // Data Processing Helpers
  // ============================================

  /**
   * Process message data and update cursor
   */
  private processMessages(messageResponses: MessageResponse[]): void {
    for (const msg of messageResponses) {
      // Skip if we already have this message under its real ID
      if (this.messages.has(msg.id)) {
        if (this.lastMessageId === null || msg.id > this.lastMessageId) {
          this.lastMessageId = msg.id;
        }
        continue;
      }

      // Skip if we sent this message — it's already displayed under a temp key
      if (this.sentRealToTempKey.has(msg.id)) {
        if (this.lastMessageId === null || msg.id > this.lastMessageId) {
          this.lastMessageId = msg.id;
        }
        continue;
      }

      const message: Message = {
        id: msg.id,
        content: msg.content,
        username: msg.username.length > 0 ? msg.username[0] ?? null : null,
        author: msg.author.toText(),
        created_at: msg.created_at,
      };

      this.messages.set(msg.id, message);

      if (this.lastMessageId === null || msg.id > this.lastMessageId) {
        this.lastMessageId = msg.id;
      }
    }

    // Keep only recent messages (buffer limit)
    if (this.messages.size > this.MAX_CLIENT_MESSAGES) {
      const sorted = Array.from(this.messages.entries()).sort(([, a], [, b]) =>
        Number(a.created_at - b.created_at)
      );

      const toKeep = sorted.slice(-this.MAX_CLIENT_MESSAGES);
      this.messages.clear();

      for (const [id, msg] of toKeep) {
        this.messages.set(id, msg);
      }
    }
  }

  // ============================================
  // Error Handling with Exponential Backoff
  // ============================================

  private async handlePollingError(source: string): Promise<void> {
    this.consecutiveFailures++;

    if (this.consecutiveFailures >= BACKOFF_CONFIG.maxRetries) {
      console.error(`Max retries reached for ${source}, stopping polling`);
      this.stopPolling();
      return;
    }

    // Apply exponential backoff
    this.backoffDelay = Math.min(
      this.backoffDelay * BACKOFF_CONFIG.multiplier,
      BACKOFF_CONFIG.maxDelay
    );

    // Wait before next attempt
    await new Promise((resolve) => setTimeout(resolve, this.backoffDelay));
  }

  private resetBackoff(): void {
    if (this.consecutiveFailures > 0) {
      this.consecutiveFailures = 0;
      this.backoffDelay = BACKOFF_CONFIG.initialDelay;
    }
  }

  // ============================================
  // Username Methods
  // ============================================

  async setUsername(username: string): Promise<void> {
    const result = await this.actor.set_username(username);

    if ('err' in result) {
      throw new Error(result.err.message);
    }

    this.myUsername = result.ok;

    toastState.show({
      message: `Username set: ${result.ok}`,
      variant: 'success'
    });
  }

  async checkUsernameAvailable(username: string): Promise<boolean> {
    return await this.actor.check_username_available(username);
  }

  // ============================================
  // Message Methods
  // ============================================

  // Counter for optimistic message temporary IDs (negative to avoid collision with real IDs)
  private nextOptimisticId = -1n;

  private async sendMessage(content: string): Promise<MessageResponse> {
    const result = await this.actor.send_message(content);

    if ('err' in result) {
      throw new Error(result.err.message);
    }

    return result.ok;
  }


  // ============================================
  // Polling Controls
  // ============================================

  /**
   * Start cursor-based polling system
   * Calls hydrateAll() once, then polls for new messages every 500ms
   */
  startPolling(): void {
    // Clear any existing timeout
    if (this.pollingTimeout) {
      clearTimeout(this.pollingTimeout);
    }

    // Initial hydration
    this.hydrateAll();

    // Start polling loop with fixed 500ms delay
    this.scheduleNextPoll();
  }

  /**
   * Stop all polling
   */
  stopPolling(): void {
    if (this.pollingTimeout) {
      clearTimeout(this.pollingTimeout);
      this.pollingTimeout = null;
    }
  }

  // ============================================
  // Form Management
  // ============================================

  setChatFormValues(values: Partial<ChatFormState>): void {
    Object.assign(this.chatForm, values);
  }

  resetChatForm(): void {
    this.chatForm = {
      message: '',
      isSubmitting: false,
      error: null
    };
  }

  submitChatMessage(): void {
    this.chatForm.error = null;

    const content = this.chatForm.message.trim();
    if (!content) return;

    if (content.length > MAX_MESSAGE_LENGTH) {
      this.chatForm.error = `Message exceeds maximum length of ${MAX_MESSAGE_LENGTH}`;
      return;
    }

    // Create optimistic message with temporary negative ID
    // No status set — renders as if already sent. Only set 'failed' on error.
    const tempId = this.nextOptimisticId--;
    const optimisticMessage: Message = {
      id: tempId,
      content,
      username: this.myUsername,
      author: user.principalText ?? '',
      created_at: BigInt(Date.now()),
    };

    // Add to messages immediately and clear input
    this.messages.set(tempId, optimisticMessage);
    this.chatForm.message = '';
    this.pendingSends++;

    // Fire-and-forget. On success, update temp entry in place (same map key = same
    // {#each} key = Svelte reuses the DOM node, zero flicker). Polling is paused
    // while pendingSends > 0, so no race. sentRealToTempKey ensures polling skips
    // this message once it resumes.
    this.sendMessage(content)
      .then((real) => {
        this.sentRealToTempKey.set(real.id, tempId);

        // Update in place — keep tempId as map key so the {#each} key is stable
        this.messages.set(tempId, {
          id: tempId,
          content: real.content,
          username: real.username.length > 0 ? real.username[0] ?? null : null,
          author: real.author.toText(),
          created_at: real.created_at,
        });
        if (this.lastMessageId === null || real.id > this.lastMessageId) {
          this.lastMessageId = real.id;
        }
      })
      .catch((error) => {
        console.error('Message send failed:', error);
        const msg = this.messages.get(tempId);
        if (msg) {
          this.messages.set(tempId, { ...msg, status: 'failed' });
        }
      })
      .finally(() => {
        this.pendingSends--;
      });
  }

  setUsernameFormValues(values: Partial<UsernameFormState>): void {
    Object.assign(this.usernameForm, values);
  }

  resetUsernameForm(): void {
    this.usernameForm = {
      username: '',
      isSubmitting: false,
      error: null
    };
  }

  async submitUsername(): Promise<void> {
    this.usernameForm.error = null;
    this.usernameForm.isSubmitting = true;

    try {
      if (!this.usernameForm.username || this.usernameForm.username.trim() === '') {
        throw new Error('Username cannot be empty');
      }

      const username = this.usernameForm.username.toLowerCase().trim();

      if (username.length < MIN_USERNAME_LENGTH) {
        throw new Error(`Username must be at least ${MIN_USERNAME_LENGTH} characters`);
      }

      if (username.length > MAX_USERNAME_LENGTH) {
        throw new Error(`Username must be at most ${MAX_USERNAME_LENGTH} characters`);
      }

      if (!/^[a-z0-9]+$/.test(username)) {
        throw new Error('Username must be lowercase alphanumeric only');
      }

      await this.setUsername(username);

      this.resetUsernameForm();
    } catch (error) {
      console.error('Username submission error:', error);
      this.usernameForm.error = error instanceof Error ? error.message : 'Failed to set username';
      throw error;
    } finally {
      this.usernameForm.isSubmitting = false;
    }
  }
}
