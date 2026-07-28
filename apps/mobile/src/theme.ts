export type TempoPalette = {
  background: string;
  surface: string;
  surfaceMuted: string;
  text: string;
  textMuted: string;
  accent: string;
  accentSoft: string;
  border: string;
  positive: string;
  negative: string;
};

export const lightPalette: TempoPalette = {
  background: "#F6F4EE",
  surface: "#FFFEFA",
  surfaceMuted: "#EEEEE8",
  text: "#14201C",
  textMuted: "#5F6D66",
  accent: "#0F6B55",
  accentSoft: "#DDEFE7",
  border: "#D9DDD6",
  positive: "#1F7156",
  negative: "#A13F38",
};

export const darkPalette: TempoPalette = {
  background: "#0E1512",
  surface: "#17201C",
  surfaceMuted: "#222C27",
  text: "#F5F1E8",
  textMuted: "#AFBAB4",
  accent: "#76D3BA",
  accentSoft: "#1D4036",
  border: "#35423C",
  positive: "#79D3A7",
  negative: "#F09A93",
};
