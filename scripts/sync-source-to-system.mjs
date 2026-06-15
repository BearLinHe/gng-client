import { readFile } from "node:fs/promises";
import path from "node:path";

import { syncSourceToSystem } from "../lib/source-sync.mjs";

await loadDotEnv(".env.local");
await syncSourceToSystem();

async function loadDotEnv(fileName) {
  const filePath = path.join(process.cwd(), fileName);
  try {
    const content = await readFile(filePath, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex < 0) continue;

      const key = trimmed.slice(0, separatorIndex);
      const value = trimmed
        .slice(separatorIndex + 1)
        .replace(/^['"]|['"]$/g, "");

      if (!process.env[key]) process.env[key] = value;
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}
