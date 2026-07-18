import { driver } from "driver.js";
import type { DriveStep } from "driver.js";
import { commonState } from "../state.svelte";
import { track } from "./analytics";

const TOUR_KEY = "mapello-onboarding-done";

export function hasSeenTour(): boolean {
    return localStorage.getItem(TOUR_KEY) !== null;
}

export function markTourSeen(): void {
    localStorage.setItem(TOUR_KEY, "1");
}

export interface TourOptions {
    force?: boolean;
    loggedIn?: boolean;
}

export function startTour(opts: TourOptions = {}): void {
    track('tour_start', { forced: opts.force ? 'true' : 'false' });
    const isMacro = commonState.currentMode === "macro";
    const loggedIn = opts.loggedIn ?? false;

    const steps: DriveStep[] = [
        {
            popover: {
                title: "Welcome to Mapello",
                description:
                    "Build stylish, exportable SVG maps. This quick tour will show you the main features — you can replay it any time from the help button.",
            },
        },
        {
            element: ".mode-selection",
            popover: {
                title: "Two modes: Macro and Detailed",
                description:
                    "<strong>Macro</strong> for countries and continents, <strong>Detailed</strong> for cities and streets. Switch any time — your work stays.",
                side: "right",
            },
        },
        {
            element: "#main-menu",
            popover: {
                title: "Your customization panel",
                description:
                    "All map controls live here: projection, layers, colors, data, legends. The <strong>General</strong> and <strong>Layers</strong> tabs at the top split global settings from per-layer ones.",
                side: "right",
            },
        },
        {
            element: "#tool-strip",
            popover: {
                title: "Draw on the map",
                description:
                    "Use this toolbar to draw curves, freehand sketches, points, and labels. Click any element on the map to add tooltips, popovers, links, or edit its styles in the properties panel.",
                side: "bottom",
            },
        },
        {
            element: "#main-menu",
            popover: {
                title: "Bind data to your map",
                description: isMacro
                    ? "In the <strong>Layers tab</strong>, add a country layer then load a CSV to color regions, show on-hover tooltips, and add a legend."
                    : "Switch to <strong>Macro mode</strong> to load a CSV and bind it to country layers for choropleth maps and legends.",
                side: "right",
            },
        },
        {
            element: loggedIn ? "#project-dropdown" : "#sign-in-btn",
            popover: {
                title: "Save your work",
                description: loggedIn
                    ? "Your project auto-saves. Use this dropdown to create new projects, rename, or load a different one."
                    : "Sign in to save multiple named projects in the cloud and pick up where you left off.",
                side: "bottom",
            },
        },
        {
            element: "#export-btn",
            popover: {
                title: "Export to SVG",
                description:
                    "One click gives you an optimized SVG you can paste straight into any HTML page — no JavaScript required.",
                side: "bottom",
            },
        },
        {
            element: "#instructions-btn",
            popover: {
                title: "Need help later?",
                description:
                    "Open this any time for a full feature reference, keyboard shortcuts, and to replay this tour.",
                side: "top",
            },
        },
    ];

    const driverObj = driver({
        showProgress: true,
        allowClose: true,
        animate: true,
        steps,
        onDestroyed: () => markTourSeen(),
    });

    driverObj.drive();
}

export function maybeStartTour(opts: Omit<TourOptions, "force"> = {}): void {
    if (hasSeenTour()) return;
    startTour(opts);
}
