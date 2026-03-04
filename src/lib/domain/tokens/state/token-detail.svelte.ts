import type { Agent } from '@icp-sdk/core/agent';
import type { NormalizedToken } from '$lib/types/entity.types';
import type { CanisterStatusResponse } from '$lib/services/ic-management.service';
import { discoverToken } from '$lib/domain/orchestration/token-discovery';
import { getCanisterStatus } from '$lib/services/ic-management.service';
import { tokenRepository } from '$lib/repositories/token.repository';

export class TokenDetailState {
  token: NormalizedToken | null = $state(null);
  isLoadingToken: boolean = $state(true);
  tokenError: string | null = $state(null);

  mintingAccount: string | null = $state(null);
  supportedStandards: string[] = $state([]);

  canisterStatus: CanisterStatusResponse | null = $state(null);
  isLoadingStatus: boolean = $state(false);
  statusError: string | null = $state(null);

  // Formatting helpers
  cyclesFormatted = $derived.by(() => {
    if (!this.canisterStatus) return null;
    return formatCycles(this.canisterStatus.cycles);
  });

  memoryFormatted = $derived.by(() => {
    if (!this.canisterStatus) return null;
    return formatBytes(this.canisterStatus.memory_size);
  });

  wasmMemoryFormatted = $derived.by(() => {
    if (!this.canisterStatus) return null;
    return formatBytes(this.canisterStatus.memory_metrics.wasm_memory_size);
  });

  stableMemoryFormatted = $derived.by(() => {
    if (!this.canisterStatus) return null;
    return formatBytes(this.canisterStatus.memory_metrics.stable_memory_size);
  });

  idleBurnFormatted = $derived.by(() => {
    if (!this.canisterStatus) return null;
    return formatCycles(this.canisterStatus.idle_cycles_burned_per_day);
  });

  statusLabel = $derived.by(() => {
    if (!this.canisterStatus) return null;
    const s = this.canisterStatus.status;
    if ('running' in s) return 'Running';
    if ('stopped' in s) return 'Stopped';
    if ('stopping' in s) return 'Stopping';
    return 'Unknown';
  });

  moduleHashHex = $derived.by(() => {
    if (!this.canisterStatus) return null;
    const hash = this.canisterStatus.module_hash;
    if (hash.length === 0) return null;
    return Array.from(hash[0] as Uint8Array).map((b: number) => b.toString(16).padStart(2, '0')).join('');
  });

  reservedCyclesFormatted = $derived.by(() => {
    if (!this.canisterStatus) return null;
    return formatCycles(this.canisterStatus.reserved_cycles);
  });

  version = $derived.by(() => {
    if (!this.canisterStatus) return null;
    return this.canisterStatus.version.toString();
  });

  // Memory metrics (all fields)
  wasmBinaryFormatted = $derived.by(() => {
    if (!this.canisterStatus) return null;
    return formatBytes(this.canisterStatus.memory_metrics.wasm_binary_size);
  });

  wasmChunkStoreFormatted = $derived.by(() => {
    if (!this.canisterStatus) return null;
    return formatBytes(this.canisterStatus.memory_metrics.wasm_chunk_store_size);
  });

  canisterHistoryFormatted = $derived.by(() => {
    if (!this.canisterStatus) return null;
    return formatBytes(this.canisterStatus.memory_metrics.canister_history_size);
  });

  snapshotsFormatted = $derived.by(() => {
    if (!this.canisterStatus) return null;
    return formatBytes(this.canisterStatus.memory_metrics.snapshots_size);
  });

  globalMemoryFormatted = $derived.by(() => {
    if (!this.canisterStatus) return null;
    return formatBytes(this.canisterStatus.memory_metrics.global_memory_size);
  });

  customSectionsFormatted = $derived.by(() => {
    if (!this.canisterStatus) return null;
    return formatBytes(this.canisterStatus.memory_metrics.custom_sections_size);
  });

  // Query stats
  queryStats = $derived.by(() => {
    if (!this.canisterStatus) return null;
    const qs = this.canisterStatus.query_stats;
    return {
      totalCalls: qs.num_calls_total.toLocaleString(),
      totalInstructions: formatLargeNumber(qs.num_instructions_total),
      requestPayload: formatBytes(qs.request_payload_bytes_total),
      responsePayload: formatBytes(qs.response_payload_bytes_total),
    };
  });

  // Settings
  freezingThreshold = $derived.by(() => {
    if (!this.canisterStatus) return null;
    const seconds = this.canisterStatus.settings.freezing_threshold;
    const days = Number(seconds) / 86400;
    return days >= 1 ? `${days.toFixed(1)} days` : `${Number(seconds).toLocaleString()} sec`;
  });

  wasmMemoryLimit = $derived.by(() => {
    if (!this.canisterStatus) return null;
    return formatBytes(this.canisterStatus.settings.wasm_memory_limit);
  });

  wasmMemoryThreshold = $derived.by(() => {
    if (!this.canisterStatus) return null;
    return formatBytes(this.canisterStatus.settings.wasm_memory_threshold);
  });

  memoryAllocation = $derived.by(() => {
    if (!this.canisterStatus) return null;
    const val = this.canisterStatus.settings.memory_allocation;
    return val === 0n ? 'Best effort' : formatBytes(val);
  });

  computeAllocation = $derived.by(() => {
    if (!this.canisterStatus) return null;
    const val = this.canisterStatus.settings.compute_allocation;
    return val === 0n ? 'Best effort' : `${val}%`;
  });

  reservedCyclesLimit = $derived.by(() => {
    if (!this.canisterStatus) return null;
    const val = this.canisterStatus.settings.reserved_cycles_limit;
    return val === 0n ? 'Unlimited' : formatCycles(val);
  });

  controllers = $derived.by(() => {
    if (!this.canisterStatus) return [];
    return this.canisterStatus.settings.controllers.map((p: { toString(): string }) => p.toString());
  });

  readyForMigration = $derived.by(() => {
    if (!this.canisterStatus) return null;
    return this.canisterStatus.ready_for_migration;
  });

  async loadToken(canisterId: string): Promise<void> {
    this.isLoadingToken = true;
    this.tokenError = null;

    try {
      const result = await discoverToken(canisterId);
      if (result) {
        this.token = result;

        // Fetch extended ICRC metadata in parallel (non-blocking)
        tokenRepository.fetchTotalSupply(canisterId).then((r) => {
          if ('ok' in r && this.token) {
            this.token = { ...this.token, totalSupply: r.ok };
          }
        });
        tokenRepository.fetchMintingAccount(canisterId).then((r) => {
          if ('ok' in r) this.mintingAccount = r.ok;
        });
        tokenRepository.fetchSupportedStandards(canisterId).then((r) => {
          if ('ok' in r) this.supportedStandards = r.ok.map((s) => s.name);
        });
      } else {
        this.tokenError = 'Token not found';
      }
    } catch (err) {
      this.tokenError = err instanceof Error ? err.message : 'Failed to load token';
    } finally {
      this.isLoadingToken = false;
    }
  }

  async loadStatus(agent: Agent, canisterId: string): Promise<void> {
    this.isLoadingStatus = true;
    this.statusError = null;

    try {
      this.canisterStatus = await getCanisterStatus(agent, canisterId);
    } catch (err) {
      console.error('[TokenDetail] canister_status failed:', err);
      this.statusError = err instanceof Error ? err.message : 'Failed to fetch canister status';
    } finally {
      this.isLoadingStatus = false;
    }
  }
}

function formatCycles(cycles: bigint): string {
  const n = Number(cycles);
  if (n >= 1e12) return `${(n / 1e12).toFixed(3)} T`;
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)} B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)} M`;
  return n.toLocaleString();
}

function formatLargeNumber(val: bigint): string {
  const n = Number(val);
  if (n >= 1e15) return `${(n / 1e15).toFixed(2)}P`;
  if (n >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatBytes(bytes: bigint): string {
  const n = Number(bytes);
  if (n >= 1024 * 1024 * 1024) return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(2)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${n} B`;
}
