/** Glassmorphism palette: light text on a dark gradient, frosted translucent surfaces. */
export const colors = {
  bgTop: "#0B1324",
  bgBottom: "#10283A",
  surface: "rgba(255,255,255,0.08)",
  surfaceStrong: "rgba(255,255,255,0.14)",
  border: "rgba(255,255,255,0.16)",
  borderStrong: "rgba(255,255,255,0.3)",
  text: "#EEF2F7",
  muted: "#A7B3C6",
  primary: "#2DD4BF",
  primaryStrong: "#14B8A6",
  primaryInk: "#04221F",
  primarySoft: "rgba(45,212,191,0.2)",
  accent: "#818CF8",
  danger: "#FB7185",
  warning: "#FBBF24",
  success: "#4ADE80",
  protein: "#60A5FA",
  carbs: "#FBBF24",
  fat: "#F472B6",
  fibre: "#4ADE80",
  headerBg: "#0D1B2E",
};

export const gradients = {
  background: [colors.bgTop, "#0F2236", colors.bgBottom] as const,
  primary: ["#2DD4BF", "#22C3E6"] as const,
  danger: ["#FB7185", "#F43F5E"] as const,
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };
export const radius = 18;
