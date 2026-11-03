import assert from "node:assert/strict";
import test from "node:test";
import app from "../app.js";

test("API health check and unauthenticated route guards", async (t) => {
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const health = await fetch(`${baseUrl}/api/health`);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { status: "ok", service: "mau-rims-api" });

  const session = await fetch(`${baseUrl}/api/auth/me`);
  assert.equal(session.status, 401);

  const rejectedOrigin = await fetch(`${baseUrl}/api/auth/logout`, {
    method: "POST",
    headers: { Origin: "https://untrusted.invalid" }
  });
  assert.equal(rejectedOrigin.status, 403);

  const viteDevOrigin = await fetch(`${baseUrl}/api/auth/logout`, {
    method: "POST",
    headers: { Origin: "http://localhost:5174" }
  });
  assert.equal(viteDevOrigin.status, 200);
  assert.equal(viteDevOrigin.headers.get("access-control-allow-origin"), "http://localhost:5174");
});
