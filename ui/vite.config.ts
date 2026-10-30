import { fileURLToPath, URL } from "node:url"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

// 打成一个普通脚本（非 ES module）放进 web/，iOS 用 file:// 加载也能跑
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  build: {
    outDir: "../web",
    emptyOutDir: false,
    minify: true,
    lib: {
      entry: "src/main.tsx",
      name: "SpectrumUIBundle",
      formats: ["iife"],
      fileName: () => "spectrum.js",
      cssFileName: "spectrum",
    },
  },
})
