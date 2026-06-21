/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Cogniva purple accent (see the architecture document).
        cogniva: "#7c3aed",
      },
    },
  },
  plugins: [],
};
