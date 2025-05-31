const Result = {
  Home: 0,
  None: 1,
  Away: 2,
};

const gameId = args[0]; // Get game ID from function arguments

// Check if API key is set
if (secrets.apiKey == "") {
  throw Error(
    "API_KEY environment variable not set. Get a free key from https://dashboard.api-football.com/register"
  );
}

// Validate gameId
if (!gameId || gameId === "0") {
  throw Error("Invalid gameId");
}

// Base URL for the Football API
const baseUrl = "https://v3.football.api-sports.io";
const endpoint = "/fixtures";

// Fetch game data by ID
const fetchGameData = async (gameId) => {
  const response = await Functions.makeHttpRequest({
    url: `${baseUrl}${endpoint}?id=${gameId}`,
    headers: { "x-apisports-key": secrets.apiKey },
  });

  if (response.status !== 200) {
    throw new Error(`HTTP Request failed with status ${response.status}`);
  }
  if (response.data.results === 0) {
    throw new Error(`Game ${gameId} not found`);
  }
  return response.data.response[0];
};

const getGameResult = async (gameId) => {
  const data = await fetchGameData(gameId);

  // Ensure the match is finished
  const status = data.fixture.status.short;
  if (!["FT", "PEN", "AET"].includes(status)) {
    throw new Error("Game not finished yet");
  }

  // Determine 0/1/2 outcome
  const homeGoals = data.goals.home;
  const awayGoals = data.goals.away;
  let outcome;
  if (homeGoals === awayGoals) {
    outcome = Result.None;
  } else {
    outcome = homeGoals > awayGoals ? Result.Home : Result.Away;
  }

  // Build flat array [outcome, homeId, awayId]
  const flat = [
    outcome,
    data.teams.home.id,
    data.teams.away.id
  ];

  function packU32Array(numbers) {
    const buffer = new ArrayBuffer(numbers.length * 4);
    const view = new DataView(buffer);

    for (let m = 0; m < numbers.length; m++) {
      const val = Number(numbers[m]);
      if (val > 0xFFFFFFFF) {
        throw Error("Value too big for 4 bytes at index " + m);
      }
      view.setUint32(m * 4, val, false); // false = big-endian
    }
    return new Uint8Array(buffer);
  }

  return packU32Array(flat);

};

// Return the encoded result
return getGameResult(gameId);
