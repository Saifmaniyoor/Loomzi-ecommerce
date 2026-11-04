import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const buildDirectory = path.join(appDirectory, "dist");
const backendPublicDirectory = path.resolve(appDirectory, "..", "loomzi-server", "public");

if (!existsSync(path.join(buildDirectory, "index.html"))) {
  throw new Error("Frontend build not found. Run Vite build before copying the files.");
}

rmSync(backendPublicDirectory, { recursive: true, force: true });
mkdirSync(backendPublicDirectory, { recursive: true });
cpSync(buildDirectory, backendPublicDirectory, { recursive: true });

console.log("Frontend build copied to loomzi-server/public for production serving.");
