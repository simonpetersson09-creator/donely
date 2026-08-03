import { rm } from "node:fs/promises";
import { resolve } from "node:path";

// A previous Vite build can leave hashed chunks behind. Starting clean keeps
// the HTML and bundled assets in lockstep for the native iOS archive.
await rm(resolve("dist"), { recursive: true, force: true });