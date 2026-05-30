"use client";

import {useMemo} from "react";

const LINE1 =
    "M 20,29.000046 H 80.000231 C 80.000231,29.000046 94.498839,28.817352 94.532987,66.711331 94.543142,77.980673 90.966081,81.670246 85.259173,81.668997 79.552261,81.667751 75.000211,74.999942 75.000211,74.999942 L 25.000021,25.000058";
const LINE2 = "M 20,50 H 80";
const LINE3 =
    "M 20,70.999954 H 80.000231 C 80.000231,70.999954 94.498839,71.182648 94.532987,33.288669 94.543142,22.019327 90.966081,18.329754 85.259173,18.331003 79.552261,18.332249 75.000211,25.000058 75.000211,25.000058 L 25.000021,74.999942";


export default function HamburgerMenu({
                                          label,
                                          isOpen,
                                          onToggleAction,
                                      }: {
    label: string;
    isOpen: boolean;
    onToggleAction: () => void;
}) {
    const aria = useMemo(
        () => ({"aria-expanded": isOpen, "aria-label": `${label} Menu`}),
        [isOpen, label]
    );

    return (
        <button type="button" className={`hud-menu ${isOpen ? "opened" : ""}`} onClick={onToggleAction} {...aria}>
      <span className="hud-menu-circle">
        <svg
            width="32"
            height="32"
            viewBox="0 0 100 100"
            className="hud-menu-svg"
        >
          <path className="line line1" d={LINE1}/>
          <path className="line line2" d={LINE2}/>
          <path className="line line3" d={LINE3}/>
        </svg>
      </span>
            <span className="hud-menu-label">{label}</span>
        </button>
    );
}