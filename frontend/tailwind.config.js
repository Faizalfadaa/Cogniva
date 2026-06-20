/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Aksen ungu Cogniva (lihat dokumen arsitektur).
        cogniva: "#7c3aed",
      },
    },
  },
  plugins: [],
};
