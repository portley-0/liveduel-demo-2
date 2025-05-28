const baseUrl = "https://v3.football.api-sports.io";
const apiKey  = secrets.apiKey;
if (!apiKey) {
  throw Error("Missing apiKey in secrets");
}

var leagueId = args[0];
var season   = args[1];
if (!leagueId || !season) {
  throw Error("Require args: tournamentId & season");
}

var headers = { "x-apisports-key": apiKey };

// 1) Fetch the list of round names (in chronological order)
var roundsResp = await Functions.makeHttpRequest({
  url: baseUrl
    + "/fixtures/rounds"
    + "?league=" + leagueId
    + "&season=" + season,
  method:  "GET",
  headers: headers
});
if (roundsResp.status !== 200) {
  throw Error("Rounds call failed: " + roundsResp.status);
}

var rounds = roundsResp.data.response;
if (!Array.isArray(rounds) || rounds.length === 0) {
  throw Error("No rounds data");
}

// 2) The latest round is the last element
var latestRound = rounds[rounds.length - 1];

// 3) Fetch all fixtures for that round (finished, live, or upcoming)
var fixturesResp = await Functions.makeHttpRequest({
  url: baseUrl
    + "/fixtures"
    + "?league=" + leagueId
    + "&season=" + season
    + "&round="  + encodeURIComponent(latestRound)
    + "&timezone=UTC",
  method:  "GET",
  headers: headers
});
if (fixturesResp.status !== 200) {
  throw Error("Fixtures call failed: " + fixturesResp.status);
}

var fixturesForRound = fixturesResp.data.response;
if (!Array.isArray(fixturesForRound) || fixturesForRound.length === 0) {
  // Don't throw an error. Instead, return a valid payload for an empty round.
  // isTournamentEnd = 0, lastIdx = 0, no fixtures to add.
  const emptyFlat = [0, 0];
  return packU32Array(emptyFlat);
}
// 4) Sort by kickoff date, extract IDs and timestamps
var sortedFixtures = fixturesForRound.slice();
sortedFixtures.sort(function(a, b) {
  return new Date(a.fixture.date).getTime()
       - new Date(b.fixture.date).getTime();
});

var ids        = [];
var timestamps = [];
for (var i = 0; i < sortedFixtures.length; i++) {
  var fx = sortedFixtures[i].fixture;
  if (typeof fx.id !== "number") {
    throw Error("Malformed fixture entry at index " + i);
  }
  ids.push(fx.id);

  if (typeof fx.timestamp !== "number") {
    throw Error("Missing timestamp in fixture at index " + i);
  }
  timestamps.push(fx.timestamp);
}

// 5) Build and pack the flat payload
var lastIdx         = ids.length - 1;
var isTournamentEnd = (ids.length === 1) ? 1 : 0;

var flat = [ isTournamentEnd, lastIdx ];
for (var j = 0; j < ids.length; j++) {
  flat.push(ids[j]);
}
for (var k = 0; k < timestamps.length; k++) {
  flat.push(timestamps[k]);
}

function packU32Array(numbers) {
  var buffer   = new ArrayBuffer(numbers.length * 4);
  var view     = new DataView(buffer);

  for (var m = 0; m < numbers.length; m++) {
    var val = Number(numbers[m]);
    if (val > 0xFFFFFFFF) {
      throw Error("Value too big for 4 bytes at index " + m);
    }
    view.setUint32(m * 4, val, false);  // false = big-endian
  }
  return new Uint8Array(buffer);
}

return packU32Array(flat);
