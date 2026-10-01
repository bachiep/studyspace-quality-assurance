import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const productionSecurityHeaders = {
  "Content-Security-Policy": "default-src 'self'; base-uri 'self'; object-src 'none'; form-action 'self'; script-src 'self'; style-src 'self'; connect-src 'self' http://localhost:4000 http://127.0.0.1:4000; img-src 'self' data:; font-src 'self'; frame-ancestors 'self'",
  "X-Frame-Options": "SAMEORIGIN",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()"
};
const developmentSecurityHeaders = { ...productionSecurityHeaders, "Content-Security-Policy": "default-src 'self'; base-uri 'self'; object-src 'none'; form-action 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' http://localhost:4000 http://127.0.0.1:4000 ws:; img-src 'self' data:; font-src 'self'; frame-ancestors 'self'" };

export default defineConfig({
  plugins: [react()],
  server: { host: "127.0.0.1", port: 5173, strictPort: true, headers: developmentSecurityHeaders },
  preview: { host: "127.0.0.1", port: 4173, strictPort: true, headers: productionSecurityHeaders }
});
