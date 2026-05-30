"use client";

import Link from "next/link";
import type {BuildOrder} from "@/types/strategy";
import {civIdFromName} from "@/lib/civs";
import Image from "next/image";
import {useState} from "react";

/** ===================== Banner config ===================== */
const DEFAULT_BANNER = "/images/banners/civs/default-banner.jpg";
const CIV_BANNER_EXT: "jpg" | "png" = "jpg";       // civ banner files extension
const BUILD_BANNER_EXT: "jpg" | "png" = "jpg";     // per-build banner files extension

/** Choose which civ to use for multi-civ builds if we need a civ fallback */
const PICK_MODE: "first" | "hash" = "first"; // or "hash" for deterministic variety

/** Build banner slug rule:
 * - lowercase
 * - '+' -> '-'
 * - remove brackets/ punctuation [](){}:,.!?'"
 * - replace non-alphanumerics with '-'
 * - collapse multiple dashes; trim leading/trailing
 */
function buildBannerSlug(name: string) {
    return name
        .trim()
        .toLowerCase()
        .replace(/\+/g, "-")
        .replace(/[()[\]{}:,.!?'"]/g, "")  // cleaned: no redundant escapes
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
}

function civBannerPath(civId?: string) {
    return civId ? `/images/banners/civs/${civId.toLowerCase()}.${CIV_BANNER_EXT}` : undefined;
}

function buildBannerPath(buildName: string) {
    const slug = buildBannerSlug(buildName);
    return `/images/banners/builds/${slug}.${BUILD_BANNER_EXT}`;
}

function pickCivIdForBanner(build: BuildOrder): string | undefined {
    const civs = build.recommended_civ_names || [];
    if (!civs.length) return undefined;

    if (PICK_MODE === "first") {
        return civIdFromName(civs[0]) || undefined;
    }

    // deterministic hash pick for variety
    let h = 0;
    for (let i = 0; i < build.id.length; i++) h = (h * 31 + build.id.charCodeAt(i)) >>> 0;
    const idx = h % civs.length;
    return civIdFromName(civs[idx]) || civIdFromName(civs[0]) || undefined;
}

/** ===================== Component ===================== */
export default function StrategyCard({build}: { build: BuildOrder }) {
    const civNames = build.recommended_civ_names || [];

    // Prefer per-build banner; if missing, fall back to civ; else default
    const expectedBuildBanner = buildBannerPath(build.name);
    const bannerCivId = pickCivIdForBanner(build);
    const civBanner = civBannerPath(bannerCivId) || DEFAULT_BANNER;

    // state-driven fallback chain so next/image can swap sources on error
    const [bannerSrc, setBannerSrc] = useState<string>(expectedBuildBanner);
    const [fallbackStep, setFallbackStep] = useState<"build" | "civ" | "default">("build");

    const handleImgError = () => {
        if (fallbackStep === "build") {
            setBannerSrc(civBanner);
            setFallbackStep("civ");
        } else if (fallbackStep === "civ") {
            setBannerSrc(DEFAULT_BANNER);
            setFallbackStep("default");
        }
        // if default fails, do nothing
    };

    // Full intro (we clamp in CSS; no mid-sentence slicing)
    const intro = (build.introduction_text || "").trim().replace(/\s+/g, " ");

    return (
        <div className="slide-card" /* if you ever swap same id with new name, set key={build.id} on parent */>
            {/* FULL-CARD banner image (no crop via object-fit: contain) */}
            <Image
                className="card-banner-img"
                src={bannerSrc}
                alt=""
                fill
                sizes="(max-width: 768px) 100vw, 340px"
                onError={handleImgError}
                unoptimized
                priority={false}
                data-expected={expectedBuildBanner} // debug helper
            />

            {/* Bottom gradient for readability over image */}
            <div className="card-overlay--footer"/>

            {/* Reveal panel (hidden until hover): intro + button */}
            <div className="card-reveal">
                <p className="card-description">{intro}</p>

                {/* Only the button navigates */}
                <Link href={`/strategy/${build.id}`} className="card-button">
                    View Strategy
                </Link>
            </div>

            {/* Footer: ALL civ pills (or Generic) + title/subtitle */}
            <div className="card-footer">
                <div className="tag-row">
                    {build.is_generic || civNames.length === 0 ? (
                        <span className="card-tag">Generic</span>
                    ) : (
                        civNames.map((name) => (
                            <span key={name} className="card-tag">
                {name}
              </span>
                        ))
                    )}
                </div>

                <h3 className="card-title">{build.name}</h3>
                <div className="card-subtitle">
                    {build.steps.length} steps • {build.source_pdf_page ? `p.${build.source_pdf_page}` : "strategy"}
                </div>
            </div>
        </div>
    );
}
