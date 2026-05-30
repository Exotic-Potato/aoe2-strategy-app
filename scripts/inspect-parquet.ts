import fs from 'fs';
import path from 'path';
import parquet from 'parquetjs-lite';

const TMP_DIR = path.join(process.cwd(), 'tmp');

// Helper to find specific files recursively
function findFile(dir: string, filename: string): string | null {
    if (!fs.existsSync(dir)) return null;

    const items = fs.readdirSync(dir);

    for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            const found = findFile(fullPath, filename);
            if (found) return found;
        } else if (item === filename) {
            return fullPath;
        }
    }
    return null;
}

async function inspectParquet(fileName: string) {
    console.log(`\n🔍 Searching for: ${fileName}...`);
    const filePath = findFile(TMP_DIR, fileName);

    if (!filePath) {
        console.error(`❌ Could not find ${fileName} inside ${TMP_DIR}`);
        return;
    }

    console.log(`✅ Found: ${filePath}`);
    console.log(`--- INSPECTING DATA ---`);

    try {
        const reader = await parquet.ParquetReader.openFile(filePath);
        const cursor = reader.getCursor();
        const record = await cursor.next();

        if (record) {
            console.log(JSON.stringify(record, null, 2));
            console.log('\n🔑 Keys:', Object.keys(record).join(', '));
        } else {
            console.log('⚠️ File is empty.');
        }

        await reader.close();
    } catch (err) {
        console.error(`❌ Error reading parquet file:`, err);
    }
}

async function main() {
    await inspectParquet('matches.parquet');
    await inspectParquet('players.parquet');
}

main();