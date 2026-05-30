import { supabaseAdmin } from '../src/lib/supabase';

async function main() {
    console.log("🔌 Testing connection to Supabase...");

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    console.log(`   Target URL: ${url}`); // Verify this looks like https://xyz.supabase.co

    try {
        // Attempt a simple query
        const { count, error } = await supabaseAdmin
            .from('matches')
            .select('*', { count: 'exact', head: true });

        if (error) {
            console.error("❌ Supabase API Error:", error.message);
            console.error("   Hint:", error.hint);
        } else {
            console.log("✅ Connection successful!");
            console.log(`📊 Current matches in DB: ${count}`);
        }
    } catch (err: any) {
        console.error("❌ Network/Client Error:", err);
        if (err.cause) {
            console.error("   Cause:", err.cause);
        }
    }
}

main();