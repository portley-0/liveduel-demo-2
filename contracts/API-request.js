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
if (gameId == "" || gameId == "0") {
  throw Error("Invalid gameId");
}

// Set the base URL and endpoint for Soccer
const baseUrl = "https://v3.football.api-sports.io";
const endpoint = "/fixtures";

// Fetch game data from the Soccer API
const fetchGameData = async (gameId) => {
  const response = await Functions.makeHttpRequest({
    url: `${baseUrl}${endpoint}?id=${gameId}`,
    headers: { "x-apisports-key": secrets.apiKey },
  });

  // Check for valid response
  if (response.status !== 200) {
    throw new Error(`HTTP Request failed with status ${response.status}`);
  }
  if (response.data.results === 0) {
    throw new Error(`Game ${gameId} not found`);
  }
  return response.data.response[0]; // Return the first game found
};

// Get the game result
const getGameResult = async (gameId) => {
  const data = await fetchGameData(gameId);

  // Check if the game is finished (Full Time)
  const status = data.fixture.status.short;
  if (!["FT", "PEN", "AET"].includes(status)) {
    throw new Error("Game not finished yet");
  }

  // Determine the winner based on the goals
  const homeGoals = data.goals.home;
  const awayGoals = data.goals.away;

  if (homeGoals === awayGoals) {
    return Functions.encodeUint256(Result.None); // Draw
  } else {
    return homeGoals > awayGoals
      ? Functions.encodeUint256(Result.Home) // Home team wins
      : Functions.encodeUint256(Result.Away); // Away team wins
  }
};

// Return the game result
return getGameResult(gameId);
