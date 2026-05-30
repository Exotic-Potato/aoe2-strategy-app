import "./globals.css";
import type {Metadata} from "next";
import React from "react";

export const metadata: Metadata = {
    title: "AoE2 Strategy Companion",
    description: "Clean, fast build orders powered by Hera's guide",
};
export default function RootLayout({children}: { children: React.ReactNode }) {
    return (
        <html lang="en" className="dark">
        <body>
        <div id="bg"/>
        <div id="overlay"/>
        <div id="page">{children}</div>
        </body>
        </html>
    );
}
