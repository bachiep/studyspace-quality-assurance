import "dotenv/config";
import { createApp } from "./app.js";
import { assertAuthenticationConfiguration } from "./auth.js";

const port = Number(process.env.PORT || 4000);
assertAuthenticationConfiguration();
createApp().listen(port, () => console.log(`StudySpace API listening on http://localhost:${port}`));
