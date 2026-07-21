/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: "#16a34a", dark: "#15803d", light: "#dcfce7" },
        risk: { aman: "#16a34a", hati: "#d97706", bahaya: "#dc2626" },
      },
    },
  },
  plugins: [],
};
