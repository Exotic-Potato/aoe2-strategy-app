// scripts/fetch-aoestats.ts

import fs from "node:fs";
import path from "node:path";

const API_BASE = "https://aoestats.io";

interface DbDumpEntry {
    start_date: string;
    end_date: string;
    num_matches: number;
    num_players: number;
    matches_url: string;  // relative URL
    players_url: string;  // relative URL
    match_checksum: string;
    player_checksum: string;
}

interface DbDumpResponse {
    db_dumps: DbDumpEntry[];
}

async function fetchJson<T>(url: string): Promise<T> {
    console.log(`🌐 GET ${url}`);

    const res = await fetch(url, {
        headers: { Accept: "application/json" },
    });

    const text = await res.text();

    console.log("   Status:", res.status);
    console.log("   Content-Type:", res.headers.get("content-type") || "unknown");

    if (!res.ok) {
        console.error("❗ Non-2xx status, body (truncated):");
        console.error(text.slice(0, 500));
        throw new Error(`HTTP ${res.status} for ${url}`);
    }

    try {
        const json = JSON.parse(text);
        return json as T;
    } catch (err) {
        console.error("❌ Failed to parse JSON. Raw body (truncated):");
        console.error(text.slice(0, 500));
        throw err;
    }
}

// 💾 super simple binary download using arrayBuffer → Buffer → writeFile
async function downloadBinary(url: string, destPath: string): Promise<void> {
    console.log(`⬇️  Downloading ${url}`);

    const res = await fetch(url);

    if (!res.ok) {
        throw new Error(`Failed to download ${url}: HTTP ${res.status}`);
    }

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    await fs.promises.mkdir(path.dirname(destPath), { recursive: true });
    await fs.promises.writeFile(destPath, buffer);

    console.log(`✅ Saved to ${destPath}`);
}

async function main() {
    console.log("🔍 Fetching DB dumps...");

    const data = await fetchJson<DbDumpResponse>(`${API_BASE}/api/db_dumps`);
    const dumps = data.db_dumps;

    if (!dumps || dumps.length === 0) {
        throw new Error("No dumps returned");
    }

    // Sort by start_date to be safe
    dumps.sort((a, b) => a.start_date.localeCompare(b.start_date));

    const latest = dumps[dumps.length - 1];

    console.log("📦 Latest dump:");
    console.log(JSON.stringify(latest, null, 2));

    // Folder name like "2025-11-16_2025-11-22"
    const range = `${latest.start_date}_${latest.end_date}`;
    const outDir = path.join(process.cwd(), "tmp", range);

    const matchesUrl = `${API_BASE}${latest.matches_url}`;
    const playersUrl = `${API_BASE}${latest.players_url}`;

    const matchesPath = path.join(outDir, "matches.parquet");
    const playersPath = path.join(outDir, "players.parquet");

    console.log(`\n📂 Output directory: ${outDir}\n`);

    await downloadBinary(matchesUrl, matchesPath);
    await downloadBinary(playersUrl, playersPath);

    console.log("\n🎉 Step 2 done: parquet files downloaded.");
    console.log("   Matches:", matchesPath);
    console.log("   Players:", playersPath);
}

main().catch((err) => {
    console.error("❌ fetch-aoestats failed:", err);
    process.exit(1);
});
