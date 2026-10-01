# Security baseline

Run the OWASP ZAP production baseline against the Vite preview (`http://127.0.0.1:4173`) after building the frontend. Save HTML/XML output in `reports/generated/zap/`.

Recorded result: ZAP 2.17.0, 0 High, 0 Medium, 0 Low, 2 Informational. Runtime dependency audit (`npm audit --omit=dev --omit=optional`) reports 0 vulnerabilities. Manual checks: unauthenticated booking returns 401; Student to `/admin/*` returns 403; token expiry returns 401; errors do not expose stack traces; secrets remain outside Git.
