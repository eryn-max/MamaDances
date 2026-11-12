// Local preview: serves public/ and the api/ functions, like Vercel does.
//   npm run dev   (then open http://localhost:3000/fr/)
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../public/", import.meta.url));
const port = Number(process.env.PORT || 3000);
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".mp4": "video/mp4" };

createServer(async (req, res) => {
  const u = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (u.pathname.startsWith("/api/")) {
      const name = u.pathname.slice(5).replace(/[^a-z-]/g, "");
      const mod = await import(new URL(`../api/${name}.js`, import.meta.url));
      if (req.method !== "POST" || !mod.POST) { res.writeHead(405).end(); return; }
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const request = new Request(u, { method: "POST", headers: req.headers, body: Buffer.concat(chunks) });
      const response = await mod.POST(request);
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
      return;
    }
    let path = normalize(join(root, decodeURIComponent(u.pathname)));
    if (!path.startsWith(root)) { res.writeHead(403).end(); return; }
    if ((await stat(path).catch(() => null))?.isDirectory()) {
      if (!u.pathname.endsWith("/")) { res.writeHead(308, { location: u.pathname + "/" + u.search }).end(); return; }
      path = join(path, "index.html");
    }
    const body = await readFile(path);
    res.writeHead(200, { "content-type": types[extname(path)] || "application/octet-stream" });
    res.end(body);
  } catch (err) {
    if (err.code !== "ENOENT") console.error(err);
    res.writeHead(err.code === "ENOENT" ? 404 : 500, { "content-type": "text/plain" }).end(err.code === "ENOENT" ? "Not found" : "Error");
  }
}).listen(port, () => console.log(`Preview on http://localhost:${port}/fr/  and  /en/`));
