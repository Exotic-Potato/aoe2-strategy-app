// /lib/aoe-stats/types.ts

// -----------------------------------------------------------------------------
// Raw models (as they come from aoestats db dumps)
// -----------------------------------------------------------------------------

/**
 * Raw "match" record from aoestats db dumps.
 * This should mirror the upstream schema as closely as possible.
 */
export interface RawMatch {
    map: string; // Map the match was played on
    started_timestamp: string; // ISO datetime, UTC
    duration: number; // Duration in seconds (in-game time)
    game_id: string; // Unique id of the game
    avg_elo: number; // Average elo of all players
    num_players: number; // Number of players involved (2, 4, 6, 8, ...)
    team_0_elo: number | null; // Average rating of team 0 (null if not applicable)
    team_1_elo: number | null; // Average rating of team 1 (null if not applicable)
    replay_enhanced: boolean; // If replay was downloaded and parsed
    leaderboard: string; // Leaderboard the match was played on
    mirror: boolean; // Whether all players are on the same civ
    patch: number; // Patch number (inferred from started_timestamp)
    raw_match_type: number; // Match type id from community API
    game_type: string; // "random_map", "empire_wars", "deathmatch", ...
    game_speed: string; // "slow", "casual", "normal", "fast"
    starting_age: string; // "dark", "feudal", "castle", "imperial", "post-imperial"
}

/**
 * Raw "player" record from aoestats db dumps.
 * One record per player per game.
 */
export interface RawPlayer {
    civ: string; // Civ used by the player (string name)
    winner: boolean; // If this player won the match
    game_id: string; // Foreign key to RawMatch.game_id
    team: number; // Team index (0, 1, 2, ...)
    feudal_age_uptime: number | null; // Time to Feudal in game minutes, if replay-enhanced
    castle_age_uptime: number | null; // Time to Castle in game minutes, if replay-enhanced
    imperial_age_uptime: number | null; // Time to Imp in game minutes, if replay-enhanced
    opening: string | null; // Inferred opening name, if replay-enhanced
    old_rating: number | null; // Rating before the match
    new_rating: number | null; // Rating after the match
    profile_id: number | null; // Unique player profile id
    match_rating_diff: number | null; // Rating diff between the two teams from this player's POV
    replay_summary_raw: string | null; // JSON string summary of units/buildings/techs (optional)
}

// -----------------------------------------------------------------------------
// Shared domain helpers
// -----------------------------------------------------------------------------

/**
 * Standard Elo bracket identifiers for aggregated stats.
 * You can tweak these if you want different bands.
 */
export type EloBracketId =
    | "0-1100"
    | "1100-1400"
    | "1400-1700"
    | "1700-2000"
    | "2000+";

/**
 * Identifier for the "kind" of leaderboard / queue.
 * Extend or narrow this as you learn more about aoestats leaderboards.
 */
export type LeaderboardId =
    | "rm_1v1"
    | "rm_team"
    | "ew_1v1"
    | "ew_team"
    | string;

/**
 * Size of each team (1v1, 2v2, 3v3, 4v4).
 */
export type TeamSize = 1 | 2 | 3 | 4;

/**
 * Bucket for duration-based splits (e.g., early vs late game).
 */
export type DurationBucket = "overall" | "early" | "late";

/**
 * Common structure for confidence intervals (e.g., Wilson score).
 */
export interface ConfidenceInterval {
    low: number; // Lower bound of WR (0–1)
    high: number; // Upper bound of WR (0–1)
}

/**
 * Aggregation context for stats — describes *where* the games were played.
 * This is the "dimension" set used to filter and group matches.
 */
export interface ContextKey {
    /**
     * Logical leaderboard identifier, e.g.:
     * - "rm_1v1"  → Random Map 1v1
     * - "rm_team" → Random Map team games (2v2–4v4)
     */
    leaderboard: LeaderboardId;

    /**
     * Team size (1 for 1v1, 2 for 2v2, etc.).
     */
    teamSize: TeamSize;

    /**
     * Map name, e.g. "Arabia", "Arena".
     * Leave undefined for "any map" aggregations.
     */
    map?: string;

    /**
     * Game type, e.g. "random_map", "empire_wars", "deathmatch".
     */
    gameType: string;

    /**
     * Starting age, e.g. "dark", "feudal", "castle", ...
     */
    startingAge?: string;

    /**
     * Elo bracket identifier, e.g. "1100-1400".
     */
    eloBracket: EloBracketId;
}

// -----------------------------------------------------------------------------
// Aggregated / derived models
// -----------------------------------------------------------------------------

/**
 * Aggregated 1v1 matchup stats (civA vs civB) within a given ContextKey.
 * This is the core lookup for questions like:
 * "1v1 Arabia 1400 Elo vs Goths — what should I do?"
 */
export interface OneVOneMatchupStats {
    context: ContextKey;
    civA: string;
    civB: string;

    /**
     * Total number of games observed in this matchup
     * (with civA on one side and civB on the other).
     */
    games: number;

    /**
     * Winrate of civA vs civB in this context (0–1).
     */
    wrA: number;

    /**
     * Winrate of civA in games that ended before 30 minutes (0–1).
     */
    wrA_early?: number;

    /**
     * Winrate of civA in games that lasted 30 minutes or longer (0–1).
     */
    wrA_late?: number;

    /**
     * Confidence interval for wrA, if computed.
     */
    ciA?: ConfidenceInterval;
}

/**
 * Aggregated team composition stats for 2v2 / 3v3 / 4v4.
 * Used to answer questions like:
 * "4v4 Arena 1500 Elo — give me a solid team comp".
 */
export interface TeamCompStats {
    context: ContextKey;

    /**
     * Civs on this team. Typically sorted alphabetically so the same
     * group of civs maps to a single key regardless of player order.
     */
    teamCivs: string[];

    /**
     * Total games played by this team composition in this context.
     */
    games: number;

    /**
     * Winrate of this team composition (0–1).
     */
    wr: number;

    /**
     * Confidence interval for wr, if computed.
     */
    ci?: ConfidenceInterval;
}

/**
 * Civ-level stats in a given context (e.g. "Franks in 4v4 Arena 1400-1700 Elo").
 */
export interface CivContextStats {
    context: ContextKey;
    civ: string;

    /**
     * Total games seen for this civ in the given context.
     */
    games: number;

    /**
     * Overall winrate in this context (0–1).
     */
    wr: number;

    /**
     * Early (< 30 min) winrate (0–1).
     */
    wr_early?: number;

    /**
     * Late (≥ 30 min) winrate (0–1).
     */
    wr_late?: number;

    /**
     * Confidence interval for wr, if computed.
     */
    ci?: ConfidenceInterval;
}

/**
 * Opening stats per civ (and optionally per matchup / context).
 * Only available for replay-enhanced matches.
 */
export interface OpeningStats {
    context: ContextKey;
    civ: string;

    /**
     * Name of the opening, e.g. "drush-archers", "scout-archers".
     */
    opening: string;

    /**
     * Total games with this (civ, opening, context).
     */
    games: number;

    /**
     * Winrate for this (civ, opening, context) (0–1).
     */
    wr: number;

    /**
     * Confidence interval for wr, if computed.
     */
    ci?: ConfidenceInterval;
}

// -----------------------------------------------------------------------------
// File-level container types for aggregated JSON outputs
// -----------------------------------------------------------------------------

/**
 * Meta information for a generated data file, e.g. which dump and patch range
 * were used and when the file was generated.
 */
export interface DataMeta {
    /**
     * ISO datetime string when the file was generated.
     */
    generatedAt: string;

    /**
     * Optional human-readable description of the patches included.
     * e.g. "patch >= 101.102.0, 2024-09-01 to 2025-01-31".
     */
    patchRange?: string;

    /**
     * Source dump URL(s) or identifiers, if you want traceability.
     */
    sourceDumps?: string[];
}

/**
 * Container for all 1v1 matchup stats (e.g. /data/matchups_1v1.json).
 */
export interface OneVOneMatchupsFile {
    meta: DataMeta;
    matchups: OneVOneMatchupStats[];
}

/**
 * Container for all team comp stats (e.g. /data/team_comps.json).
 */
export interface TeamCompsFile {
    meta: DataMeta;
    comps: TeamCompStats[];
}

/**
 * Container for per-civ context stats (e.g. /data/civ_stats.json).
 */
export interface CivStatsFile {
    meta: DataMeta;
    civs: CivContextStats[];
}

/**
 * Container for opening stats (e.g. /data/openings.json).
 */
export interface OpeningsFile {
    meta: DataMeta;
    openings: OpeningStats[];
}

// -----------------------------------------------------------------------------
// Chatbot / tool argument & result types (used by the advice API)
// -----------------------------------------------------------------------------

/**
 * Arguments for a "getMatchupStats" tool.
 * This will be used by the LLM to query 1v1 matchup data.
 */
export interface GetMatchupStatsArgs {
    myCiv?: string;
    oppCiv?: string;

    /**
     * For future flexibility we allow oppCivs as an array (team matchups),
     * but for now 1v1 will mostly use a single oppCiv.
     */
    oppCivs?: string[];

    teamSize?: TeamSize;
    eloMin?: number;
    eloMax?: number;
    map?: string;
    gameType?: string;
    startingAge?: string;
}

/**
 * Result shape for "getMatchupStats" tool.
 */
export interface GetMatchupStatsResult {
    context: ContextKey;

    /**
     * Direct matchup stats if myCiv was specified.
     */
    direct?: OneVOneMatchupStats;

    /**
     * If myCiv was not specified, this can return good "counter picks"
     * vs the given oppCiv in the given context.
     */
    bestPicks?: {
        civ: string;
        wr: number; // 0–1
        games: number;
        ci?: ConfidenceInterval;
    }[];

    warnings?: string[];
}

/**
 * Arguments for a "getTeamComps" tool (for 2v2 / 3v3 / 4v4).
 */
export interface GetTeamCompsArgs {
    teamSize: Exclude<TeamSize, 1>; // 2 | 3 | 4
    eloMin?: number;
    eloMax?: number;
    map?: string;
    gameType?: string;
    startingAge?: string;

    /**
     * Civs that must be present in the team (e.g. "we already have Franks and Britons").
     */
    mustInclude?: string[];

    maxResults?: number;
}

/**
 * Result shape for "getTeamComps" tool.
 */
export interface GetTeamCompsResult {
    context: ContextKey;
    comps: {
        civs: string[];
        wr: number; // 0–1
        games: number;
        ci?: ConfidenceInterval;
    }[];
    warnings?: string[];
}

/**
 * Arguments for a "getCivStats" tool – per civ, per context.
 */
export interface GetCivStatsArgs {
    civ: string;
    teamSize?: TeamSize;
    eloMin?: number;
    eloMax?: number;
    map?: string;
    gameType?: string;
    startingAge?: string;
}

/**
 * Result shape for "getCivStats" tool.
 */
export interface GetCivStatsResult {
    context: ContextKey;
    stats?: CivContextStats;
    warnings?: string[];
}

/**
 * Arguments for a "getOpenings" tool – per civ, per context (and optional opponent).
 */
export interface GetOpeningsArgs {
    civ: string;
    oppCiv?: string;
    teamSize?: TeamSize;
    eloMin?: number;
    eloMax?: number;
    map?: string;
    gameType?: string;
    startingAge?: string;
    maxResults?: number;
}

/**
 * Result shape for "getOpenings" tool.
 */
export interface GetOpeningsResult {
    context: ContextKey;
    openings: OpeningStats[];
    warnings?: string[];
}
