const primaryIds = [6035872082, 7326934954, 6931042565];
const brookhavenUniverseId = 1686885941;
const endpoint = "https://games.roblox.com/v1/games";

async function fetchGames(ids) {
  const url = `${endpoint}?universeIds=${ids.join(",")}`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Oreun-R1-CI/0.2",
    },
  });

  if (res.status === 429) {
    return {
      status: "rate_limited",
      retryAfter: res.headers.get("retry-after"),
      found: [],
    };
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const json = await res.json();
  return {
    status: "ok",
    found: (json.data ?? []).map((item) => ({
      id: item.id,
      name: item.name,
      playing: item.playing,
    })),
  };
}

try {
  const primary = await fetchGames(primaryIds);
  if (
    primary.status === "ok" &&
    !primary.found.some((item) => item.id === primaryIds[0])
  ) {
    console.error(
      JSON.stringify({ status: "primary_required_id_missing", primary }, null, 2),
    );
    process.exit(1);
  }

  let brookhaven;
  try {
    const result = await fetchGames([brookhavenUniverseId]);
    brookhaven = {
      ...result,
      requestedUniverseId: brookhavenUniverseId,
      requestedUniverseReturned:
        result.status === "ok" &&
        result.found.some((item) => item.id === brookhavenUniverseId),
    };
  } catch (error) {
    brookhaven = {
      status: "error",
      requestedUniverseId: brookhavenUniverseId,
      requestedUniverseReturned: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  console.log(
    JSON.stringify(
      {
        status: "ok",
        primary,
        brookhavenDiagnostic: brookhaven,
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.warn(
    `Provider smoke non-fatal: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(0);
}
