const Result = {
  Home: 0,
  None: 1,
  Away: 2,
};

const gameId = args[0];              // required
const salt   = args[1] || "";        // optional cache-buster from Solidity

if (secrets.apiKey == "") {
  throw Error("API_KEY not set. Get one at https://dashboard.api-football.com/register");
}

if (!gameId || gameId === "0") {
  throw Error("Invalid gameId");
}

const baseUrl = "https://v3.football.api-sports.io";
const endpoint = "/fixtures";

const fetchGameData = async (gameId) => {
  const url = `${baseUrl}${endpoint}?id=${gameId}`;
  const response = await Functions.makeHttpRequest({
    url,
    headers: {
      "x-apisports-key": secrets.apiKey,
      "Cache-Control": "no-store",
      "Pragma": "no-cache",
      ...(salt ? { "X-Request-Nonce": String(salt) } : {}),
    },
  });

  if (response.error) {
    throw new Error(`HTTP error: ${JSON.stringify(response.error)}`);
  }
  if (response.status !== 200) {
    throw new Error(`HTTP Request failed with status ${response.status}`);
  }
  if (response.data.results === 0) {
    throw new Error(
      `Game ${gameId} not found; details=` +
      JSON.stringify({ errors: response.data.errors, parameters: response.data.parameters })
    );
  }
  return response.data.response[0];
};

const getGameResult = async (gameId) => {
  const data = await fetchGameData(gameId);

  const status = data.fixture.status.short;
  if (!["FT", "PEN", "AET"].includes(status)) {
    throw new Error("Game not finished yet");
  }

  const homeGoals = data.goals.home;
  const awayGoals = data.goals.away;
  const outcome =
    homeGoals === awayGoals ? Result.None : (homeGoals > awayGoals ? Result.Home : Result.Away);

  const flat = [outcome, data.teams.home.id, data.teams.away.id];

  function packU32Array(numbers) {
    const buffer = new ArrayBuffer(numbers.length * 4);
    const view = new DataView(buffer);
    for (let m = 0; m < numbers.length; m++) {
      const val = Number(numbers[m]);
      if (val > 0xFFFFFFFF) throw Error("Value too big for 4 bytes at index " + m);
      view.setUint32(m * 4, val, false); // big-endian
    }
    return new Uint8Array(buffer);
  }

  return packU32Array(flat);
};

return getGameResult(gameId);
