# Security baseline

Run the OWASP ZAP production baseline against the Vite preview (`http://127.0.0.1:4173`) after building the frontend. Save HTML/XML output in `reports/generated/zap/`.

Final recorded result: quality-evidence run 37328055551 ghi nhận frontend 0 High/0 Medium/9 Low/5 Informational và public API 0 High/0 Medium/0 Low/2 Informational. Đây là unauthenticated baseline, không phải authenticated scan hoặc penetration test. Runtime dependency audit (`npm audit --omit=dev --omit=optional`) reports 0 vulnerabilities. Manual checks: unauthenticated booking returns 401; Student to `/admin/*` returns 403; token expiry returns 401; errors do not expose stack traces; secrets remain outside Git.
