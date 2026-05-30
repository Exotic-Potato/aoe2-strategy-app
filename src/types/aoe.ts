/**
 * types/aoe.ts
 * Definitions for AOE2 match data coming from Parquet/DuckDB
 */

// --- 1. RAW PARQUET DATA (What DuckDB returns) ---
// Note: DuckDB returns 'bigint' for 64-bit integers.
// Timestamps are often returned as Date objects.

export interface RawMatchRow {
    game_id: bigint;           // e.g. 433384874n
    map: string;               // e.g. "arabia"
    started_timestamp: Date;   // ISO Date
    duration: bigint;          // Nanoseconds (e.g. 1110100000000n)
    irl_duration: bigint;      // Nanoseconds
    avg_elo: number;           // e.g. 1203.5
    num_players: bigint;       // e.g. 2n
    team_0_elo: number;
    team_1_elo: number;
    replay_enhanced: boolean;
    leaderboard: string;       // e.g. "random_map"
    mirror: boolean;
    patch: string;
    raw_match_type: string;    // e.g. "6"
    game_type: string;         // e.g. "random_map"
    game_speed: string;        // e.g. "normal"
    starting_age: string;      // e.g. "dark"
}

export interface RawPlayerRow {
    game_id: bigint;           // Foreign Key to RawMatchRow
    profile_id: bigint;        // Player ID (e.g. 23934176n)
    team: bigint;              // 0n or 1n
    winner: boolean;
    civ: string;               // e.g. "vietnamese"
    old_rating: bigint;
    new_rating: bigint;
    match_rating_diff: number; // e.g. -7
    feudal_age_uptime: number | null;
    castle_age_uptime: number | null;
    imperial_age_uptime: number | null;
    opening: string | null;
    replay_summary_raw: string; // JSON string "{...}"
}

// --- 2. NORMALIZED APP DATA (What we send to Supabase/Frontend) ---
// We convert BigInts to Numbers (for durations) or Strings (for IDs) to avoid serialization issues.

export interface Match {
    match_id: string;          // Converted from game_id
    map: string;
    started_at: string;        // ISO String
    duration_seconds: number;  // Converted from nanoseconds
    average_elo: number;
    num_players: number;
    leaderboard: string;
    server: string | null;     // Extra field if needed later
    patch: string;
    game_type: string;
    game_speed: string;
}

export interface PlayerResult {
    match_id: string;
    profile_id: string;
    team_id: number;
    civ_name: string;
    is_winner: boolean;
    rating: number;            // new_rating
    rating_change: number;     // match_rating_diff
    feudal_time: number | null;
    castle_time: number | null;
    imperial_time: number | null;
}