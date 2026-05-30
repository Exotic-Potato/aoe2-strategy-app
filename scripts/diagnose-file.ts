// scripts/diagnose-file.ts
import fs from 'fs';
import path from 'path';

const TMP_DIR = path.join(process.cwd(), 'tmp');

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

function checkFileHeader(filename: string) {
    const filePath = findFile(TMP_DIR, filename);
    if (!filePath) {
        console.log(`❌ Could not find ${filename}`);
        return;
    }

    console.log(`\n🕵️ DIAGNOSING: ${path.basename(filePath)}`);

    // Read first 50 bytes
    const buffer = Buffer.alloc(50);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buffer, 0, 50, 0);
    fs.closeSync(fd);

    const asString = buffer.toString('utf8');
    const asHex = buffer.toString('hex');

    console.log(`HEADER (Text):  ${asString.replace(/\n/g, ' ')}`);
    console.log(`HEADER (Hex):   ${asHex.substring(0, 30)}...`);

    if (asString.startsWith('PAR1')) {
        console.log("✅ Result: Valid Parquet Header detected.");
    } else if (asString.includes('<!DOCTYPE') || asString.includes('<html')) {
        console.log("❌ Result: This is an HTML file (likely an error page).");
    } else if (asHex.startsWith('1f8b')) {
        console.log("⚠️ Result: This is a GZIP file (needs decompression).");
    } else {
        console.log("❓ Result: Unknown format.");
    }
}

checkFileHeader('matches.parquet');