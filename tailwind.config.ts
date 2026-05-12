import type { Config } from "tailwindcss";
import { stitchTailwindTheme } from "./lib/design-system/tokens";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./features/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: stitchTailwindTheme
  },
  plugins: []
};

export default config;
