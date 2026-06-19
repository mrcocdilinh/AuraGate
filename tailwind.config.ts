import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#030A18",
        bg2: "#06122B",
        panel: "#0B1A3A",
        panel2: "#0F2248",
        line: "#1B2E52",
        ink: "#F7FAFF",
        muted: "#9BA8C7",
        primary: "#3E73FF",
        "primary-600": "#2B5CE6",
        mint: "#00CBB8",
        cyan: "#00F0FF",
        purple: "#8A4DFF",
        amber: "#FFC56E",
        danger: "#FF6B6B",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        xl: "14px",
        "2xl": "20px",
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(0,240,255,0.10), 0 8px 40px -12px rgba(62,115,255,0.40)",
      },
      keyframes: {
        float: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
      },
      animation: {
        float: "float 6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
