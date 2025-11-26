import { defineConfig } from "vite";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig(() => {
  return {
    server: {
      port: 8080,
    },
    plugins: [cloudflare()],
  };
});
