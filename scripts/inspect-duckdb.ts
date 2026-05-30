// scripts/inspect-duckdb.ts
import { Database } from 'duckdb-async';
import path from 'path';
import fs from 'fs';

const TMP_DIR = path.join(process.cwd(), 'tmp');

// Helper to find file (same as before)
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

async function inspect(fileName: string) {
    const filePath = findFile(TMP_DIR, fileName);
    if (!filePath) {
        console.error(`❌ Could not find ${fileName}`);
        return;
    }

    console.log(`\n🦆 INSPECTING via DuckDB: ${fileName}`);

    const db = await Database.create(':memory:'); // In-memory DB

    try {
        // DuckDB can query parquet files directly!
        const rows = await db.all(`SELECT * FROM '${filePath}' LIMIT 1`);

        if (rows.length > 0) {
            const record = rows[0];
            console.log('✅ Success! First row sample:');

            // Fix BigInt error by converting them to strings for display
            console.log(JSON.stringify(record, (key, value) =>
                    typeof value === 'bigint' ? value.toString() : value
                , 2));

            console.log('\n🔑 Columns:', Object.keys(record).join(', '));
        } else {
            console.log('⚠️ File appears empty.');
        }
    } catch (err) {
        console.error('❌ DuckDB failed to read file:', err);
    }
}

async function main() {
    await inspect('matches.parquet');
    await inspect('players.parquet');
}

main();