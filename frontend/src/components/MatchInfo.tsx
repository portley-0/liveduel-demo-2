import React from "react";
import { MatchData } from "@/types/MatchData.ts"; // Import Match type

const MatchInfo: React.FC<{ match: MatchData }> = ({ match }) => {
  return (
    <div className="bg-greyblue p-10 rounded-lg text-white shadow-md">
      <h2 className="text-lg font-bold">Match Information</h2>
      <p className="mt-2 text-sm">
        Details about {match.homeTeamName} vs {match.awayTeamName}.
      </p>

      {/* Placeholder sections */}
      <div className="mt-4">
        <h3 className="text-md font-semibold">Live Events</h3>
        <ul className="mt-2 text-sm">
          <li>⚽ Goal - {match.homeTeamName} (12')</li>
          <li>🟨 Yellow Card - {match.awayTeamName} (35')</li>
          <li>🔄 Substitution - {match.homeTeamName} (60')</li>
        </ul>
      </div>

      <div className="mt-4">
        <h3 className="text-md font-semibold">Standings (Placeholder)</h3>
        <p className="text-sm">League table and match statistics will go here.</p>
      </div>
    </div>
  );
};

export default MatchInfo;
