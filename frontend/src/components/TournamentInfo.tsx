import React from "react";
import { LeagueStanding, TeamStanding } from "@/types/MatchData.ts";
import { TournamentData } from "@/types/TournamentData.ts";

const TournamentInfo: React.FC<{ tournament: TournamentData }> = ({ tournament }) => {
  const standings = tournament.standings;

  if (!standings?.league?.standings || standings.league.standings.length === 0) {
    return <p className="text-sm text-gray-400">No standings available.</p>;
  }

  const flatStandings: TeamStanding[] = Array.isArray(standings.league.standings[0])
    ? (standings.league.standings as TeamStanding[][]).flat()
    : (standings.league.standings as TeamStanding[]);

  const groupedStandings: Record<string, TeamStanding[]> = {};
  flatStandings.forEach((team) => {
    if (!groupedStandings[team.group]) {
      groupedStandings[team.group] = [];
    }
    groupedStandings[team.group].push(team);
  });

  return (
    <div className="bg-darkblue p-3 text-white shadow-md flex flex-col">
      <h3 className="text-lg font-semibold">{standings.league.name} Standings</h3>

      <div className="overflow-x-auto mt-4">
        {Object.entries(groupedStandings).map(([groupName, teams]) => (
          <div key={groupName} className="mb-6">
            <h4 className="text-md font-semibold mt-2 mb-1 text-redmagenta">{groupName}</h4>

            <table className="w-full text-sm mt-2 border border-gray-700">
              <thead>
                <tr className="bg-gray-800 text-white">
                  <th className="p-2 text-left">#</th>
                  <th className="p-2 text-left">Team</th>
                  <th className="p-2 text-center">Pts</th>
                  <th className="p-2 text-center">GD</th>
                  <th className="p-2 text-center">Form</th>
                </tr>
              </thead>
              <tbody>
                {teams.map((team) => (
                  <tr key={team.team.id} className="border-t border-gray-600">
                    <td className="p-2">{team.rank}</td>
                    <td className="p-2 flex items-center">
                      <img src={team.team.logo} alt={team.team.name} className="w-5 h-5 mr-2" />
                      {team.team.name}
                    </td>
                    <td className="p-2 text-center">{team.points}</td>
                    <td className="p-2 text-center">{team.goalsDiff}</td>
                    <td className="p-2 text-center">{team.form ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TournamentInfo;