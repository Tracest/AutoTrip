import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#172033",
        mist: "#f5f7fb",
        accent: "#e25c2f",
        pine: "#0f766e",
        gold: "#d7a514"
      },
      boxShadow: {
        soft: "0 16px 48px rgba(23, 32, 51, 0.12)"
      },
      backgroundImage: {
        "hero-grid":
          "linear-gradient(rgba(23,32,51,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(23,32,51,0.04) 1px, transparent 1px)"
      }
    }
  },
  plugins: []
};

export default config;
