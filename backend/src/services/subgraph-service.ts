const { request, gql } = require('graphql-request');
//const cache = require('../cache');

const EVENTS_QUERY = gql`
  query {
    # Adjust to match your subgraph schema
    sharesSoldEvents {
      id
      user
      amount
    }
    sharesPurchasedEvents {
      id
      user
      amount
    }
    oddsUpdatedEvents {
      id
      newOdds
    }
  }
`;

async function fetchSubgraphData() {
  try {
    const endpoint = process.env.SUBGRAPH_URL;
    const data = await request(endpoint, EVENTS_QUERY);

    // For example, let's grab the latest odds
    if (data?.oddsUpdatedEvents?.length) {
      const latest = data.oddsUpdatedEvents[data.oddsUpdatedEvents.length - 1];
      cache.odds = latest.newOdds;
    }

    // For sharesSold or sharesPurchased, you could update the userPredictions
    // ...
  } catch (error) {
    console.error('Error fetching subgraph data:', error);
  }
}

module.exports = { fetchSubgraphData };
