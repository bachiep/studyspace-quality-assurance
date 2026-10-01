# Security baseline

Run OWASP ZAP Baseline against `http://localhost:5173` after starting frontend/backend. Save HTML/XML output in `reports/generated/zap/`.

Manual checks: unauthenticated booking returns 401; Student to `/admin/*` returns 403; token expiry returns 401; errors do not expose stack traces; secrets remain outside Git.
