import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#070A12",
        bg2: "#0B0F1A",
        panel: "#11151F",
        panel2: "#161B27",
        line: "#222838",
        ink: "#E7ECF5",
        muted: "#8A93A6",
        primary: "#4D7CFF",
        "primary-600": "#3B66E0",
        mint: "#3FE0B8",
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
        glow: "0 0 0 1px rgba(77,124,255,0.18), 0 8px 40px -12px rgba(77,124,255,0.35)",
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