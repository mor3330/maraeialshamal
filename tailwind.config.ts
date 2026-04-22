import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#0f1511",
        card: "#1a2420",
        "card-hi": "#223029",
        green: {
          DEFAULT: "#3fa66a",
          dark: "#2d8050",
        },
        cream: "#f4ede0",
        muted: "#8a9690",
        line: "#2a3832",
        red: "#e06b5c",
        amber: "#e3a857",
      },
      fontFamily: {
        sans: ["Readex Pro", "Tajawal", "sans-serif"],
      },
      fontSize: {
        "cashier-num": ["32px", { fontWeight: "900" }],
      },
      keyframes: {
        shake: {
          "0%, 100%": { transform: "translateX(0)" },
          "20%": { transform: "translateX(-8px)" },
          "40%": { transform: "translateX(8px)" },
          "60%": { transform: "translateX(-5px)" },
          "80%": { transform: "translateX(5px)" },
        },
      },
      animation: {
        shake: "shake 0.5s ease-in-out",
      },
    },
  },
  plugins: [],
};
export default config;
