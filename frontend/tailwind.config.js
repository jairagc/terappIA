/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class", // your HTML used dark mode via class
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // shared across your files
        primary: "#08255e",            // or "#101922" if you prefer dark-navy; keep one source of truth
        "background-light": "#f6f6f8", // from multiple pages
        "background-dark": "#101622",
        "calm-blue": "#f0f7ff",
        "dark-navy": "#101922",
        "light-gray": "#e7edf3",
        "text-primary": "#101922",
        "text-secondary": "#4c739a",
      },
      fontFamily: {
        display: ["Inter", "sans-serif"], // enables className="font-display"
      },
      borderRadius: {
        DEFAULT: "0.5rem",
        lg: "0.75rem",
        xl: "1rem",
        full: "9999px",
      },
      boxShadow: {
        subtle: "0 4px 12px 0 rgba(0, 0, 0, 0.05)",
      },
    },
  },
  plugins: [
    require("@tailwindcss/forms"),
    require("@tailwindcss/container-queries"),
  ],
};
