import data from "data/strategy.json";
import type { StrategyData } from "@/types/strategy";

const d = data as StrategyData;

const nameToId = new Map<string, string>();
d.civilizations.forEach((c) => nameToId.set(c.name.toLowerCase(), c.id));

export function civIdFromName(name?: string) {
    if (!name) return undefined;
    return nameToId.get(name.toLowerCase());
}
