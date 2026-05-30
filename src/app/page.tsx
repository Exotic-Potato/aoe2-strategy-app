"use client";

import {useEffect, useMemo, useRef, useState} from "react";
import Image from "next/image";

import data from "data/strategy.json";
import type {StrategyData, BuildOrder} from "@/types/strategy";
import StrategyCard from "./components/StrategyCard";
import {civIdFromName} from "@/lib/civs";
import HamburgerMenu from "./components/HamburgerMenu";

/** ================== Tags (Units) ================== */
type Tag =
    | "rush"
    | "boom"
    | "archer"
    | "scout"
    | "knight"
    | "monk"
    | "unique"
    | "spear"
    | "skirm"
    | "cavarcher";

const TAGS: { key: Tag; label: string; query: string[] }[] = [
    {key: "rush", label: "Rush", query: ["rush", "fast up", "maa", "scout", "militia"]},
    {key: "boom", label: "Boom", query: ["boom", "tc boom", "booming"]},
    {key: "archer", label: "Archer", query: ["archer", "xbow", "crossbow", "arbalest"]},
    {key: "scout", label: "Scout", query: ["scout", "light cavalry"]},
    {key: "knight", label: "Knight", query: ["knight", "cavalry"]},
    {key: "monk", label: "Monk", query: ["monk", "relic"]},
    {key: "unique", label: "Unique Unit", query: ["unique", "uu"]},
    {key: "spear", label: "Spear", query: ["spearman", "pike", "halb"]},
    {key: "skirm", label: "Skirmisher", query: ["skirm"]},
    {key: "cavarcher", label: "Cav Archer", query: ["cav archer", "cav-archer"]},
];

type StrategyMode = "all" | "generic" | "civ"; // menu: Strategies

const d = data as StrategyData;
const builds = d.buildOrders as BuildOrder[];
const civsSorted = [...d.civilizations].sort((a, b) => a.name.localeCompare(b.name));

export default function Home() {
    // Search
    const [query, setQuery] = useState("");
    const [expandedSearch, setExpandedSearch] = useState(false);
    const searchRef = useRef<HTMLInputElement>(null);

    // Filters
    const [filterCivId, setFilterCivId] = useState<string | undefined>(undefined);
    const [strategyMode, setStrategyMode] = useState<StrategyMode>("all");
    const [activeTag, setActiveTag] = useState<Tag | null>(null);

    // HUD menus
    const [openMenu, setOpenMenu] = useState<null | "civs" | "strategies" | "units">(null);

    // Close on ESC
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpenMenu(null);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();

        return builds.filter((b) => {
            // --- Strategy Mode ---
            if (strategyMode === "generic" && !b.is_generic) return false;
            if (strategyMode === "civ" && b.is_generic) return false;

            // --- Civilization selection ---
            if (filterCivId) {
                if (b.is_generic) {
                    // If user explicitly chose a civ and mode != generic-only,
                    // generic builds are allowed only when strategyMode === "all"
                    if (strategyMode !== "all") return false;
                } else {
                    const hasCiv = b.recommended_civ_names.some(
                        (name) => civIdFromName(name) === filterCivId
                    );
                    if (!hasCiv) return false;
                }
            }

            // --- Unit Tag (Units menu) ---
            if (activeTag) {
                const words = TAGS.find((t) => t.key === activeTag)?.query ?? [];
                const text = (b.name + " " + b.introduction_text).toLowerCase();
                const hit = words.some((w) => text.includes(w));
                if (!hit) return false;
            }

            // --- Text search ---
            if (!q) return true;
            return (
                b.name.toLowerCase().includes(q) ||
                b.introduction_text.toLowerCase().includes(q)
            );
        });
    }, [query, filterCivId, strategyMode, activeTag]);

    // Helpers
    const closeHUD = () => setOpenMenu(null);
    const isHUDOpen = openMenu !== null;

    return (
        <main className="container">
            {/* === Top Bar: menus (left) + search (middle) + brand (right) === */}
            <div className="toolbar glass hud-toolbar hud-banner">
                {/* LEFT: Menus */}
                <div className="hud-left">
                    <HamburgerMenu
                        label="Civilizations"
                        isOpen={openMenu === "civs"}
                        onToggleAction={() => setOpenMenu(openMenu === "civs" ? null : "civs")}
                    />
                    <HamburgerMenu
                        label="Strategies"
                        isOpen={openMenu === "strategies"}
                        onToggleAction={() =>
                            setOpenMenu(openMenu === "strategies" ? null : "strategies")
                        }
                    />
                    <HamburgerMenu
                        label="Units"
                        isOpen={openMenu === "units"}
                        onToggleAction={() => setOpenMenu(openMenu === "units" ? null : "units")}
                    />
                </div>

                {/* MIDDLE: Search (right of Units) */}
                <div className="hud-search-wrap">
                    <div
                        className={`search-box glass ${expandedSearch ? "expanded" : ""}`}
                        onClick={() => {
                            setExpandedSearch(true);
                            searchRef.current?.focus();
                        }}
                        onMouseEnter={() => setExpandedSearch(true)}
                        onMouseLeave={() => {
                            if (!query && document.activeElement !== searchRef.current) {
                                setExpandedSearch(false);
                            }
                        }}
                    >
                        <button
                            type="button"
                            className="search-btn"
                            aria-label="Search"
                            title="Search"
                            onClick={() => {
                                setExpandedSearch(true);
                                searchRef.current?.focus();
                            }}
                        >
                            <Image
                                src="/CampaignIcon-EdwardDE.webp"
                                alt="Search"
                                width={60}
                                height={60}
                                className="search-icon"
                            />
                        </button>
                        <input
                            ref={searchRef}
                            type="text"
                            placeholder="Search strategies…"
                            className="search-text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onFocus={() => setExpandedSearch(true)}
                            onBlur={() => {
                                if (!query) setExpandedSearch(false);
                            }}
                        />
                    </div>
                </div>

                {/* RIGHT: Hera logo chip */}
                <div className="brand-chip" title="Hera">
                    <Image
                        src="/images/hera-logo.png"
                        alt="Hera"
                        width={60}
                        height={60}
                        className="brand-chip-img"
                    />
                </div>
            </div>

            {/* === HUD Overlay (click outside to close) === */}
            {isHUDOpen && (
                <>
                    <div className="hud-backdrop" onClick={closeHUD}/>

                    <section className="hud-panel glass gold-edge" role="dialog" aria-modal="true">
                        {openMenu === "civs" && (
                            <div className="hud-section">
                                <div className="hud-section-title">Pick a Civilization</div>
                                <div className="civ-grid">
                                    {/* All civs option */}
                                    <button
                                        className={`civ-item ${!filterCivId ? "active" : ""}`}
                                        onClick={() => {
                                            setFilterCivId(undefined);
                                            closeHUD();
                                        }}
                                    >
                    <span className="civ-icon-wrap">
                      <span className="civ-icon-placeholder">★</span>
                    </span>
                                        <span className="civ-name">All Civilizations</span>
                                    </button>

                                    {civsSorted.map((civ) => (
                                        <button
                                            key={civ.id}
                                            className={`civ-item ${filterCivId === civ.id ? "active" : ""}`}
                                            onClick={() => {
                                                setFilterCivId(civ.id);
                                                closeHUD();
                                            }}
                                        >
                      <span className="civ-icon-wrap">
                        <Image
                            src={`/civs/${civ.id}.png`}
                            alt={civ.name}
                            width={28}
                            height={28}
                            className="civ-icon"
                        />
                      </span>
                                            <span className="civ-name">{civ.name}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {openMenu === "strategies" && (
                            <div className="hud-section">
                                <div className="hud-section-title">Strategy Type</div>
                                <div className="pill-row">
                                    <button
                                        className={`pill ${strategyMode === "all" ? "active" : ""}`}
                                        onClick={() => setStrategyMode("all")}
                                    >
                                        All Strategies
                                    </button>
                                    <button
                                        className={`pill ${strategyMode === "generic" ? "active" : ""}`}
                                        onClick={() => setStrategyMode("generic")}
                                    >
                                        Generic Only
                                    </button>
                                    <button
                                        className={`pill ${strategyMode === "civ" ? "active" : ""}`}
                                        onClick={() => setStrategyMode("civ")}
                                    >
                                        Civ-Specific Only
                                    </button>
                                </div>
                                <div className="hint">
                                    Tip: If a civilization is selected, “Civ-Specific Only” shows builds for that civ.
                                </div>
                            </div>
                        )}

                        {openMenu === "units" && (
                            <div className="hud-section">
                                <div className="hud-section-title">Units / Openings</div>
                                <div className="pill-row">
                                    <button
                                        className={`pill ${activeTag === null ? "active" : ""}`}
                                        onClick={() => setActiveTag(null)}
                                    >
                                        All Units
                                    </button>
                                    {TAGS.map((t) => (
                                        <button
                                            key={t.key}
                                            className={`pill ${activeTag === t.key ? "active" : ""}`}
                                            onClick={() => setActiveTag(t.key)}
                                        >
                                            {t.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </section>
                </>
            )}

            {/* === Cards Grid === */}
            {filtered.length > 0 ? (
                <div className={`cards-grid ${isHUDOpen ? "blurred-underlay" : ""}`}>
                    {filtered.map((b) => (
                        <StrategyCard key={b.id} build={b}/>
                    ))}
                </div>
            ) : (
                <p
                    style={{
                        textAlign: "center",
                        color: "var(--muted)",
                        padding: "64px 0",
                        fontSize: "1rem",
                    }}
                >
                    No strategies match your filters. Try clearing a filter.
                </p>
            )}
        </main>
    );
}
