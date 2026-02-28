export const IS_LOCAL = process.env.DFX_NETWORK === 'local';
export const HOST = IS_LOCAL ? "http://localhost:8080" : "https://ic0.app";

// Derivation origin for Internet Identity - ensures same principal across domains
// Toggle comment for staging vs production deployments
export const DERIVATION_ORIGIN = IS_LOCAL
    ? 'http://localhost:3000'
    // : 'https://partyhats.xyz';
    : 'https://icphats.io'; // staging

export const canisterIds = {
    registry: process.env.CANISTER_ID_REGISTRY,
    indexer: process.env.CANISTER_ID_INDEXER,
    treasury: process.env.CANISTER_ID_TREASURY,
    icrc_ledger: process.env.CANISTER_ID_PARTY_LEDGER ?? '7xkvf-zyaaa-aaaal-ajvra-cai', // PARTY token ledger
    icp_ledger: process.env.CANISTER_ID_ICP_LEDGER ?? 'ryjl3-tyaaa-aaaaa-aaaba-cai',
    trollbox: process.env.CANISTER_ID_TROLLBOX,
    oracle: process.env.CANISTER_ID_ORACLE,
    // SIWE/SIWS canisters for multi-chain wallet support
    siwe: process.env.CANISTER_ID_IC_SIWE,
    siws: process.env.CANISTER_ID_IC_SIWS,
    // Internet Identity - NNS canister IDs differ between local and mainnet
    internetIdentity: process.env.CANISTER_ID_INTERNET_IDENTITY
        ?? 'rdmx6-jaaaa-aaaaa-aaadq-cai',
};

// Date and time
export const SECONDS_IN_MINUTE = 60;
export const MINUTES_IN_HOUR = 60;
export const HOURS_IN_DAY = 24;

export const SECONDS_IN_HOUR = SECONDS_IN_MINUTE * MINUTES_IN_HOUR;
export const SECONDS_IN_DAY = SECONDS_IN_HOUR * HOURS_IN_DAY;

export const MILLISECONDS_IN_SECOND = 1000;
export const MILLISECONDS_IN_DAY = SECONDS_IN_DAY * MILLISECONDS_IN_SECOND;

/** Sentinel for permanent lock (year 9999-12-31T00:00:00Z in ms). Matches TimeMs.PERMANENT_LOCK_MS in backend. */
export const PERMANENT_LOCK_MS = 253_402_300_800_000n;

export const NANO_SECONDS_IN_MILLISECOND = 1_000_000n;
export const NANO_SECONDS_IN_SECOND = NANO_SECONDS_IN_MILLISECOND * 1_000n;
export const NANO_SECONDS_IN_MINUTE = NANO_SECONDS_IN_SECOND * 60n;

// For some use case we want to display some amount to a maximal number of decimals which is not related to the number of decimals of the selected token.
// Just a value that looks good visually.
export const EIGHT_DECIMALS = 8;

export const ZERO = 0n;

/** Quote token symbols treated as USD-pegged (rate = 1.0, no oracle needed). Lowercase. */
export const STABLECOIN_SYMBOLS: ReadonlySet<string> = new Set(['usdt', 'usdc', 'ckusdt', 'ckusdc']);
