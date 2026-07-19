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
  background: "#F3F0E8",
  surface: "#FFFDF8",
  surfaceMuted: "#EAE6DC",
  text: "#17211E",
  textMuted: "#64706A",
  accent: "#176B5B",
  accentSoft: "#D9EBE5",
  border: "#DCD7CB",
  positive: "#24735A",
  negative: "#9A4A43",
};

export const darkPalette: TempoPalette = {
  background: "#101613",
  surface: "#18211D",
  surfaceMuted: "#222C27",
  text: "#F5F1E8",
  textMuted: "#AAB5AF",
  accent: "#70C9B6",
  accentSoft: "#223F37",
  border: "#35423C",
  positive: "#70C9A0",
  negative: "#E4968F",
};
