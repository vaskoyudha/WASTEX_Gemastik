/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: "#667F63", dark: "#304331", light: "#D8E0D5" },
        forest: { 950: "#26362A", 900: "#304331", 800: "#3E5640", 700: "#5D7458", 600: "#667F63" },
        sage: { 500: "#849880", 300: "#C2CDC0", 200: "#D8E0D5" },
        mist: { 100: "#E9EEE7", 50: "#F2F5F0" },
        cream: { 50: "#FAFBF7" },
        lime: { 400: "#CAEE82", 300: "#DCF5A7" },
        risk: { aman: "#16a34a", hati: "#d97706", bahaya: "#dc2626" },
      },
      fontFamily: {
        sans: ["Inter_400Regular"],
        medium: ["Inter_500Medium"],
        semibold: ["Inter_600SemiBold"],
        bold: ["Inter_700Bold"],
        extrabold: ["Inter_800ExtraBold"],
      },
    },
  },
  plugins: [],
};
