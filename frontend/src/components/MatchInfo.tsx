import React from "react";
import { MatchData } from "@/types/MatchData.ts"; 

const MatchInfo: React.FC<{ match: MatchData }> = ({ match }) => {
  return (
    <div className="bg-greyblue p-6 rounded-xl text-white shadow-md h-full max-h-screen overflow-y-auto flex flex-col">
      {/* Header */}
      <h2 className="text-lg font-bold">Match Information</h2>
      <p className="mt-2 text-sm">
        Details about {match.homeTeamName} vs {match.awayTeamName}.
      </p>

      {/* Live Events Section */}
      <div className="mt-4 flex-1">
        <h3 className="text-md font-semibold">Live Events</h3>
        <ul className="mt-2 text-sm space-y-1">
          <li>⚽ Goal - {match.homeTeamName} (12')</li>
          <li>🟨 Yellow Card - {match.awayTeamName} (35')</li>
          <li>🔄 Substitution - {match.homeTeamName} (60')</li>
        </ul>
      </div>

      {/* Standings Section */}
      <div className="mt-4 flex-1">
        <h3 className="text-md font-semibold">Standings</h3>
        <p className="text-sm">League table and match statistics will go here.</p>
      </div>
    </div>
  );
};

export default MatchInfo;
