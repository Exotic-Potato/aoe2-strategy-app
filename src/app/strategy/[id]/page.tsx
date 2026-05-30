import Image from "next/image";
import Link from "next/link";
import {notFound} from "next/navigation";
import data from "data/strategy.json";
import type {StrategyData, BuildOrder} from "@/types/strategy";
import type {Metadata} from "next";
import React from "react";

/** Resource order & icons shown on the right */
const RES_ORDER = [
    {key: "food", label: "Food", src: "/icons/food.svg"},
    {key: "wood", label: "Wood", src: "/icons/wood.svg"},
    {key: "gold", label: "Gold", src: "/icons/gold.svg"},
    {key: "stone", label: "Stone", src: "/icons/stone.svg"},
    {key: "pop", label: "Pop", src: "/icons/pop.svg"},
] as const;

type Totals = { food: number; wood: number; gold: number; stone: number; pop: number };
type Op = "set" | "add" | "move" | null;
type Move = { from: keyof Totals; to: keyof Totals; amount: number };

const VALID_KEYS = ["food", "wood", "gold", "stone", "pop"] as const;

/** Age icons shown inline on the left (instead of the age text prefix) */
const AGE_ICONS: Record<string, string> = {
    "dark age": "/ages/dark-age.png",
    "feudal age": "/ages/feudal-age.png",
    "castle age": "/ages/castle-age.png",
    "imperial age": "/ages/imperial-age.png",
};

function detectAge(stepText: string): string | null {
    const lower = stepText.toLowerCase();
    for (const key of Object.keys(AGE_ICONS)) {
        if (lower.includes(key)) return key;
    }
    return null;
}

/** Parse tail annotation like:
 *  "… @@set:food=6,pop=6"
 *  "… @@add:wood=5,pop=11"
 *  "… @@move:food=6>wood=6,food=2>stone=2"
 */
function parseAnnotatedStep(raw: string): {
    displayText: string;
    op: Op;
    changes: Partial<Totals>;
    moves: Move[];
} {
    const at = raw.indexOf("@@");
    if (at === -1) return {displayText: raw, op: null, changes: {}, moves: []};

    const displayText = raw.slice(0, at).trim().replace(/[,.]\s*$/, "");
    const ann = raw.slice(at + 2).trim();

    const m = ann.match(/^(set|add|move)\s*:(.*)$/i);
    if (!m) return {displayText, op: null, changes: {}, moves: []};

    const op = m[1].toLowerCase() as Op;
    const rest = (m[2] || "").trim();

    // SET / ADD: key=value, key=value…
    if (op === "set" || op === "add") {
        const pairs = rest
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);

        const changes: Partial<Totals> = {};
        for (const p of pairs) {
            const [kRaw, vRaw] = p.split("=").map((s) => s.trim().toLowerCase());
            if (!kRaw || vRaw == null) continue;
            const num = Number(vRaw);
            if (!Number.isFinite(num)) continue;
            if ((VALID_KEYS as readonly string[]).includes(kRaw)) {
                changes[kRaw as keyof Totals] = num;
            }
        }
        return {displayText, op, changes, moves: []};
    }

    // MOVE: from=6>to=6, from=2>to=2 …
    if (op === "move") {
        const items = rest
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);

        const moves: Move[] = [];
        for (const item of items) {
            const mm = item.match(/^([a-z]+)\s*=\s*(\d+)\s*>\s*([a-z]+)\s*=\s*(\d+)$/i);
            if (!mm) continue;

            const from = mm[1].toLowerCase();
            const amtL = Number(mm[2]);
            const to = mm[3].toLowerCase();
            const amount = Number.isFinite(amtL) ? amtL : 0;

            if (
                (VALID_KEYS as readonly string[]).includes(from) &&
                (VALID_KEYS as readonly string[]).includes(to) &&
                from !== "pop" &&
                to !== "pop" &&
                amount > 0
            ) {
                moves.push({from: from as keyof Totals, to: to as keyof Totals, amount});
            }
        }
        return {displayText, op, changes: {}, moves};
    }

    return {displayText, op: null, changes: {}, moves: []};
}

/** Apply @@set / @@add / @@move to running totals.
 *  POP is always treated as absolute when provided (not delta).
 */
function apply(op: Op, changes: Partial<Totals>, moves: Move[], prev: Totals): Totals {
    const next = {...prev};

    if (op === "set" || op === "add") {
        for (const key of Object.keys(changes) as (keyof Totals)[]) {
            const val = changes[key]!;
            if (key === "pop") {
                next.pop = val; // absolute population
            } else {
                next[key] = op === "set" ? val : (next[key] ?? 0) + val;
            }
        }
        return next;
    }

    if (op === "move") {
        for (const mv of moves) {
            const amt = Math.max(0, Math.floor(mv.amount));
            if (!amt) continue;
            const fromVal = next[mv.from] ?? 0;
            const moved = Math.min(fromVal, amt);
            next[mv.from] = fromVal - moved;
            next[mv.to] = (next[mv.to] ?? 0) + moved;
        }
        return next;
    }

    return next;
}

export function generateStaticParams() {
    const d = data as StrategyData;
    return d.buildOrders.map((b) => ({id: b.id}));
}

export async function generateMetadata({
                                           params,
                                       }: {
    params: Promise<{ id: string }>;
}): Promise<Metadata> {
    const {id} = await params;
    const d = data as StrategyData;
    const build = d.buildOrders.find((b) => b.id === id);
    if (!build) return {title: "Strategy not found · AoE2 Strategy Companion"};
    const desc = (build.introduction_text || "").trim().replace(/\s+/g, " ").slice(0, 155);
    return {
        title: `${build.name} · AoE2 Strategy Companion`,
        description: desc || undefined,
    };
}

export default async function StrategyPage({
                                               params,
                                           }: {
    params: Promise<{ id: string }>;
}) {
    const {id} = await params; // unwrap

    const d = data as StrategyData;
    const build = d.buildOrders.find((b) => b.id === id) as BuildOrder | undefined;

    if (!build) notFound();

    // Build rows: { text (without annotation), totals after step }
    const rows: { text: string; totals: Totals }[] = [];
    let running: Totals = {food: 0, wood: 0, gold: 0, stone: 0, pop: 0};

    for (const raw of build.steps) {
        const {displayText, op, changes, moves} = parseAnnotatedStep(raw);

        // If annotation didn't specify pop, try to parse "Vil Pop N" from prefix text
        if (changes.pop === undefined) {
            const m = displayText.match(/vil\s*pop\s*(\d+)/i);
            if (m) {
                const n = Number(m[1]);
                if (Number.isFinite(n)) changes.pop = n;
            }
        }

        running = apply(op, changes, moves, running);
        rows.push({
            text: displayText || raw.replace(/@@.*/, "").trim(),
            totals: {...running},
        });
    }

    const COL_W = 56;

    return (
        <main className="container" style={{maxWidth: 860}}>
            <Link
                href="/"
                style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    marginBottom: 16,
                    color: "var(--muted)",
                    textDecoration: "none",
                }}
            >
                ← Back to strategies
            </Link>
            <h1 style={{fontSize: "1.8rem", fontWeight: 800, marginBottom: 8}}>
                {build.name}
            </h1>

            {build.introduction_text && (
                <p style={{color: "var(--muted)", whiteSpace: "pre-line", marginBottom: 18}}>
                    {build.introduction_text}
                </p>
            )}

            {/* Build Steps with left age icon + right resource strip */}
            <div
                style={{
                    padding: 16,
                    borderRadius: 16,
                    background: "rgba(18,20,25,.78)",
                    border: "1px solid rgba(255,255,255,.08)",
                    marginBottom: 16,
                }}
            >
                {/* header row: left title + right icon columns */}
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: `1fr auto`,
                        alignItems: "end",
                        gap: 12,
                        marginBottom: 10,
                    }}
                >
                    <div style={{fontWeight: 700, fontSize: "1.2rem"}}>Build Steps</div>

                    <div
                        style={{
                            display: "grid",
                            gridAutoFlow: "column",
                            gridAutoColumns: `${COL_W}px`,
                            justifyContent: "end",
                            gap: 8,
                        }}
                    >
                        {RES_ORDER.map((r) => (
                            <div
                                key={r.key}
                                style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                    gap: 4,
                                    opacity: 0.9,
                                }}
                            >
                                <Image src={r.src} alt={r.label} width={22} height={22}/>
                                <span style={{fontSize: ".75rem", color: "var(--muted)"}}>{r.label}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <ol style={{paddingLeft: 20, margin: 0, display: "grid", gap: 8}}>
                    {rows.map((row, i) => (
                        <li
                            key={i}
                            style={{
                                listStylePosition: "outside",
                                display: "grid",
                                gridTemplateColumns: `1fr auto`,
                                alignItems: "center",
                                gap: 12,
                                padding: "8px 6px",
                                borderRadius: 10,
                            }}
                        >
                            {/* Step text with optional age icon prefix */}
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                    paddingRight: 8,
                                    lineHeight: 1.5,
                                }}
                            >
                                {(() => {
                                    const age = detectAge(row.text);
                                    if (age) {
                                        return (
                                            <Image
                                                src={AGE_ICONS[age]}
                                                alt={age}
                                                width={26}
                                                height={26}
                                                style={{flexShrink: 0, opacity: 0.9}}
                                            />
                                        );
                                    }
                                    return null;
                                })()}

                                <span>
  {row.text
      // only remove the prefix "Dark Age - " etc. at the START of the line
      .replace(/^\s*Dark Age\s*[:-]\s*/i, "")
      .replace(/^\s*Feudal Age\s*[:-]\s*/i, "")
      .replace(/^\s*Castle Age\s*[:-]\s*/i, "")
      .replace(/^\s*Imperial Age\s*[:-]\s*/i, "")}
</span>
                            </div>

                            {/* right resource totals */}
                            <div
                                style={{
                                    display: "grid",
                                    gridAutoFlow: "column",
                                    gridAutoColumns: `${COL_W}px`,
                                    justifyContent: "end",
                                    gap: 8,
                                    minHeight: 28,
                                }}
                            >
                                {RES_ORDER.map((r) => (
                                    <div
                                        key={r.key}
                                        style={{display: "flex", alignItems: "center", justifyContent: "center"}}
                                    >
                    <span
                        style={{
                            fontWeight: 800,
                            color: "var(--text)",
                            fontVariantNumeric:
                                "tabular-nums" as React.CSSProperties["fontVariantNumeric"],
                        }}
                    >
                      {row.totals[r.key as keyof Totals] ?? 0}
                    </span>
                                    </div>
                                ))}
                            </div>
                        </li>
                    ))}
                </ol>
            </div>

            {build.whats_next_text && (
                <>
                    <h2 style={{fontSize: "1.2rem", fontWeight: 700, marginTop: 16, marginBottom: 8}}>
                        What’s Next
                    </h2>
                    <p style={{color: "var(--muted)", whiteSpace: "pre-line"}}>
                        {build.whats_next_text}
                    </p>
                </>
            )}

            {build.video_url && (
                <div style={{marginTop: 16}}>
                    <a href={build.video_url} target="_blank" rel="noreferrer" style={{color: "var(--accent)"}}>
                        Watch Video Tutorial
                    </a>
                </div>
            )}
        </main>
    );
}
