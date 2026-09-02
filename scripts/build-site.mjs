import { cp, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

const projectRoot = process.cwd();
const distRoot = join(projectRoot, "dist");
const clientRoot = join(distRoot, "client");
const serverRoot = join(distRoot, "server");
const publicDirectories = ["admin-demo", "ai-center", "assets", "data"];

await rm(distRoot, { recursive: true, force: true });
await mkdir(clientRoot, { recursive: true });
await mkdir(serverRoot, { recursive: true });

const rootEntries = await readdir(projectRoot, { withFileTypes: true });
for (const entry of rootEntries) {
  if (entry.isFile() && entry.name.endsWith(".html")) {
    await cp(join(projectRoot, entry.name), join(clientRoot, entry.name));
  }
}

for (const directory of publicDirectories) {
  await cp(join(projectRoot, directory), join(clientRoot, directory), { recursive: true });
}

const workerSource = `const worker = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.endsWith("/")) url.pathname += "index.html";

    let response = await env.ASSETS.fetch(new Request(url, request));
    if (response.status === 404 && !url.pathname.split("/").pop().includes(".")) {
      url.pathname += ".html";
      response = await env.ASSETS.fetch(new Request(url, request));
    }
    return response;
  },
};

export default worker;
`;

await writeFile(join(serverRoot, "index.js"), workerSource, "utf8");
console.log("Static site build completed: dist/client + dist/server/index.js");