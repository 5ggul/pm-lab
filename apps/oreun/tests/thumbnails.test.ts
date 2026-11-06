import test from "node:test";
import assert from "node:assert/strict";
import { RobloxThumbnailProvider } from "../lib/providers/roblox-thumbnails";

test("thumbnail provider maps completed images and hides pending placeholders", async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        data: [
          { targetId: 1, state: "Completed", imageUrl: "https://example.com/one.png" },
          { targetId: 2, state: "Pending", imageUrl: "https://example.com/two.png" },
          { targetId: 0, state: "Completed", imageUrl: "https://example.com/zero.png" },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    )) as typeof fetch;
  t.after(() => { globalThis.fetch = originalFetch; });

  const rows = await new RobloxThumbnailProvider().getGameIcons([1, 2]);
  assert.deepEqual(rows, [
    { universeId: 1, imageUrl: "https://example.com/one.png", state: "Completed" },
    { universeId: 2, imageUrl: null, state: "Pending" },
  ]);
});
