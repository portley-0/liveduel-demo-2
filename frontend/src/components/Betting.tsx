import React from "react";
import { MatchData } from "@/types/MatchData.ts"; 

const Betting: React.FC<{ match: MatchData }> = ({ match }) => {
  return (
    <div className="bg-greyblue p-6 rounded-lg text-white shadow-md">
      <h2 className="text-lg font-bold">Betting Interface</h2>
      <p className="mt-2 text-sm">Bet on {match.homeTeamName} vs {match.awayTeamName}</p>

      {/* Placeholder betting buttons */}
      <div className="mt-4 flex space-x-4">
        <button className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600">
          Bet on {match.homeTeamName}
        </button>
        <button className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600">
          Bet on Draw
        </button>
        <button className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600">
          Bet on {match.awayTeamName}
        </button>
      </div>
    </div>
  );
};

export default Betting;
