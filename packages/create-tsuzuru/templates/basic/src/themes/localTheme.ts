import type { TsuzuruTheme } from "@tsuzuru/standard-ui-preact";

export const localTheme = {
  id: "local",
  name: "Local Theme",
  tokens: {
    colors: {
      surface: "rgba(20, 20, 28, 0.88)",
      surfaceBorder: "rgba(255, 255, 255, 0.18)",
      text: "#f7f3ea",
      mutedText: "#b8b2a6",
      accent: "#d6a85f",
    },
    messageWindow: {
      borderRadius: "18px",
      padding: "1.2rem 1.5rem",
      shadow: "0 18px 48px rgba(0, 0, 0, 0.42)",
    },
    choiceLayer: {
      gap: "10px",
      buttonPadding: "10px 14px",
    },
  },
} satisfies TsuzuruTheme;
