import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const types = { ".html": "text/html", ".json": "application/json", ".css": "text/css" };

export async function startTestServer(html = null, port = 0) {
  const server = createServer(async (request, response) => {
    const pathname = new URL(request.url, "http://localhost").pathname;
    if (pathname === "/" && html !== null) {
      response.writeHead(200, { "Content-Type": "text/html" }).end(html);
      return;
    }
    const filename = resolve(root, `.${pathname}${pathname.endsWith("/") ? "index.html" : ""}`);
    if (!filename.startsWith(root.endsWith(sep) ? root : `${root}${sep}`)) {
      response.writeHead(403).end();
      return;
    }
    try {
      const body = await readFile(filename);
      response.writeHead(200, { "Content-Type": types[extname(filename)] || "text/javascript" }).end(body);
    } catch { response.writeHead(404).end(); }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await startTestServer(null, 8080);
