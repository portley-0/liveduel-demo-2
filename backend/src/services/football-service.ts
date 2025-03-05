const axios = require('axios');
const cache = require('../cache');

async function fetchMatchData() {
  try {
    // Example endpoint (replace fixture or league ID as needed)
    const response = await axios.get('https://v3.football.api-sports.io/fixtures', {
      params: {
        id: 'YOUR_FIXTURE_ID', // or other params
      },
      headers: {
        'x-rapidapi-key': process.env.API_FOOTBALL_KEY,
        'x-rapidapi-host': 'v3.football.api-sports.io',
      },
    });

    const fixture = response.data?.response?.[0] || {};
    const newMatchData = {
      score: fixture.goals,  // e.g., { home: number, away: number }
      // Add red cards, scorers, etc. as needed
    };

    // Update our cache
    cache.matchData = newMatchData;
  } catch (error) {
    console.error('Error fetching match data:', error);
  }
}

module.exports = { fetchMatchData };
