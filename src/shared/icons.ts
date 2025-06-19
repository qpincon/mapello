import { extractFileName } from "../util/common";

export const icons: Record<string, string> = import.meta.glob("../assets/img/*.svg", {
    eager: true,
    query: "?raw",
    import: "default",
});

Object.keys(icons).forEach((iconName) => {
    const name = extractFileName(iconName);
    icons[name] = icons[iconName];
    delete icons[iconName];
});