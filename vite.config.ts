import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  worker: {
    format: "es",
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // The 196K wordlist raw text (~7MB) — only needed by admin
          if (id.includes("NWL2023.txt")) {
            return "wordlist"
          }
          // Crossword generator — only needed by admin
          if (id.includes("crosswordGenerator")) {
            return "crossword-generator"
          }
          // React + React DOM
          if (id.includes("node_modules/react-dom")) {
            return "react-vendor"
          }
          if (id.includes("node_modules/react/") || id.includes("node_modules/react-router")) {
            return "react-vendor"
          }
          // InstantDB
          if (id.includes("node_modules/@instantdb")) {
            return "instantdb"
          }
          // Motion
          if (id.includes("node_modules/motion")) {
            return "motion"
          }
        },
      },
    },
  },
})
