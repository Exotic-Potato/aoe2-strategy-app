// scripts/load-data.ts
import { Database } from 'duckdb-async';
import path from 'path';
import fs from 'fs';
import { supabaseAdmin } from '@/lib/supabase';
import { RawMatchRow, RawPlayerRow } from '@/types/aoe';

// --- CONFIGURATION ---
const BATCH_SIZE = 2000;
const TMP_DIR = path.join(process.cwd(), 'tmp');

// --- TYPES FOR SUPABASE INSERT ---
interface MatchInsert {
    match_id: string;
    map_name: string;
    started_at: string;
    duration_seconds: number | null;
    average_elo: number | null;
    game_type: string | null;
    patch: string | null;
}

interface PlayerInsert {
    match_id: string;
    profile_id: string;
    civ_name: string;
    is_winner: boolean;
    team_id: number | null;
    rating: number | null;
    rating_change: number | null;
    feudal_time: number | null;
    castle_time: number | null;
    imperial_time: number | null;
}

// --- HELPER: Find File recursively ---
function findFile(dir: string, filename: string): string | null {
    if (!fs.existsSync(dir)) return null;
    const items = fs.readdirSync(dir);
    for (const item of items) {
        const fullPath = path.join(dir, item);
        if (fs.statSync(fullPath).isDirectory()) {
            const found = findFile(fullPath, filename);
            if (found) return found;
        } else if (item === filename) {
            return fullPath;
        }
    }
    return null;
}

// --- HELPER: Safe Conversion ---
const safeString = (val: unknown): string | null =>
    (val === null || val === undefined) ? null : String(val);

// NEW HELPER: Rounds numbers to Integers to satisfy Postgres
const safeInt = (val: unknown): number | null => {
    if (val === null || val === undefined) return null;
    const num = Number(val);
    return isNaN(num) ? null : Math.round(num);
};

async function main() {
    console.log("🚀 Starting ETL Process...");

    // 1. Locate Files
    const matchesPath = findFile(TMP_DIR, 'matches.parquet');
    const playersPath = findFile(TMP_DIR, 'players.parquet');

    if (!matchesPath || !playersPath) {
        console.error("❌ Could not find parquet files in tmp/");
        process.exit(1);
    }

    // 2. Initialize DuckDB
    const db = await Database.create(':memory:');

    try {
        // --- PART A: LOAD MATCHES ---
        console.log(`\n📄 Reading Matches from: ${path.basename(matchesPath)}`);

        const countResult = await db.all(`SELECT COUNT(*) as c FROM '${matchesPath}'`);
        const totalMatches = Number(countResult[0].c);
        console.log(`📊 Found ${totalMatches} matches to process.`);

        for (let offset = 0; offset < totalMatches; offset += BATCH_SIZE) {
            const rows = await db.all(`
                SELECT * FROM '${matchesPath}'
                    LIMIT ${BATCH_SIZE} OFFSET ${offset}
            `) as RawMatchRow[];

            const cleanMatches: MatchInsert[] = rows.map(row => {
                let startedAt = new Date().toISOString();
                try {
                    if (row.started_timestamp) {
                        const ts = typeof row.started_timestamp === 'bigint'
                            ? Number(row.started_timestamp)
                            : row.started_timestamp;
                        startedAt = new Date(ts).toISOString();
                    }
                } catch (e) { console.warn("Date error", e); }

                // DURATION FIX: Ensure it's a number before dividing
                const rawDuration = Number(row.duration) || 0;

                return {
                    match_id: safeString(row.game_id) ?? '',
                    map_name: safeString(row.map) ?? 'Unknown',
                    started_at: startedAt,
                    duration_seconds: Math.floor(rawDuration / 1_000_000_000),
                    average_elo: safeInt(row.avg_elo), // <-- ROUNDED
                    game_type: safeString(row.game_type),
                    patch: safeString(row.patch)
                };
            });

            const { error } = await supabaseAdmin
                .from('matches')
                .upsert(cleanMatches, { onConflict: 'match_id' });

            if (error) {
                console.error(`❌ Error inserting match batch ${offset}:`, error.message);
            } else {
                process.stdout.write(`\r✅ Matches: ${Math.min(offset + BATCH_SIZE, totalMatches)} / ${totalMatches}`);
            }
        }
        console.log("\n✅ Matches loaded successfully!");


        // --- PART B: LOAD PLAYERS ---
        console.log(`\n📄 Reading Players from: ${path.basename(playersPath)}`);

        const pCountResult = await db.all(`SELECT COUNT(*) as c FROM '${playersPath}'`);
        const totalPlayers = Number(pCountResult[0].c);
        console.log(`📊 Found ${totalPlayers} player records.`);

        for (let offset = 0; offset < totalPlayers; offset += BATCH_SIZE) {
            const rows = await db.all(`
                SELECT * FROM '${playersPath}'
                    LIMIT ${BATCH_SIZE} OFFSET ${offset}
            `) as RawPlayerRow[];

            const cleanPlayers: PlayerInsert[] = rows.map(row => ({
                match_id: safeString(row.game_id) ?? '',
                profile_id: safeString(row.profile_id) ?? '',
                civ_name: safeString(row.civ) ?? 'Unknown',
                is_winner: Boolean(row.winner),
                team_id: safeInt(row.team),
                rating: safeInt(row.new_rating),          // <-- ROUNDED
                rating_change: safeInt(row.match_rating_diff), // <-- ROUNDED
                feudal_time: safeInt(row.feudal_age_uptime),   // <-- ROUNDED
                castle_time: safeInt(row.castle_age_uptime),   // <-- ROUNDED
                imperial_time: safeInt(row.imperial_age_uptime)// <-- ROUNDED
            }));

            const { error } = await supabaseAdmin
                .from('match_players')
                .upsert(cleanPlayers, { onConflict: 'id' as never, ignoreDuplicates: true });

            if (error) {
                console.error(`❌ Error inserting player batch ${offset}:`, error.message);
            } else {
                process.stdout.write(`\r✅ Players: ${Math.min(offset + BATCH_SIZE, totalPlayers)} / ${totalPlayers}`);
            }
        }

        console.log("\n🎉 ETL Process Complete!");

    } catch (err: unknown) {
        if (err instanceof Error) {
            console.error("\n❌ Fatal Error:", err.message);
        } else {
            console.error("\n❌ Fatal Error:", String(err));
        }
    }
}

main();