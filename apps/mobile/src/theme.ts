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
  background: "#FFFFFF",
  surface: "#FFFFFF",
  surfaceMuted: "#F2F2F0",
  text: "#181818",
  textMuted: "#62625E",
  accent: "#1F1F1F",
  accentSoft: "#E9E9E6",
  border: "#D8D8D3",
  positive: "#21644F",
  negative: "#9B3D34",
};

export const darkPalette: TempoPalette = {
  background: "#151515",
  surface: "#191919",
  surfaceMuted: "#242424",
  text: "#F2F1ED",
  textMuted: "#A7A7A2",
  accent: "#F2F1ED",
  accentSoft: "#30302E",
  border: "#3A3A37",
  positive: "#83BEA5",
  negative: "#E38B82",
};
