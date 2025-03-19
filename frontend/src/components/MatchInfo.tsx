import React, { useState } from "react";
import { LeagueStanding, FixtureEvent, FixtureStatistics, FixtureLineups, MatchData, TeamStanding } from "@/types/MatchData.ts";

const MENU_ITEMS = ["Events", "Statistics", "Lineups", "Standings"];

const MatchInfo: React.FC<{ match: MatchData }> = ({ match }) => {
  const [activeTab, setActiveTab] = useState<string>("Standings");

  return (
    <div className="bg-darkblue p-1 text-white shadow-md flex flex-col">
      <div className="flex border-b border-gray-600">
        {MENU_ITEMS.map((item) => (
          <button
            key={item}
            className={`flex-1 text-center py-2 font-semibold transition-all ${
              activeTab === item
                ? "text-redmagenta border-b-2 border-redmagenta"
                : "text-white hover:text-gray-300"
            }`}
            onClick={() => setActiveTab(item)}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="mt-4 flex-1 pb-20">
        {activeTab === "Events" && <EventsSection events={match.events} />}
        {activeTab === "Statistics" && <StatisticsSection statistics={match.statistics} />}
        {activeTab === "Lineups" && <LineupsSection lineups={match.lineups} />}
        {activeTab === "Standings" && <StandingsSection standings={match.standings} />}
      </div>
    </div>
  );
};

const EventsSection: React.FC<{ events?: FixtureEvent[] }> = ({ events }) => {
  if (!events || events.length === 0) {
    return <p className="text-sm text-gray-400">No events available.</p>;
  }

  return (
    <ul className="space-y-2">
      {events.map((event, index) => (
        <li key={index} className="text-sm flex items-center space-x-2">
          <span>{event.time.elapsed}'</span>
          <img src={event.team.logo} alt={event.team.name} className="w-5 h-5" />
          <span>{event.type} - {event.detail}</span>
          <span>{event.player.name}</span>
        </li>
      ))}
    </ul>
  );
};

const StatisticsSection: React.FC<{ statistics?: FixtureStatistics }> = ({ statistics }) => {
  if (!statistics?.home || !statistics.away) {
    return <p className="text-sm text-gray-400">No statistics available.</p>;
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left border-b border-gray-600">
          <th className="py-2">Statistic</th>
          <th className="py-2 text-center">{statistics.home.name}</th>
          <th className="py-2 text-center">{statistics.away.name}</th>
        </tr>
      </thead>
      <tbody>
        {statistics.home.stats.map((stat, index) => (
          <tr key={index} className="border-b border-gray-600">
            <td className="py-2">{stat.type}</td>
            <td className="py-2 text-center">{stat.value ?? "-"}</td>
            <td className="py-2 text-center">{statistics.away?.stats[index]?.value ?? "-"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

const LineupsSection: React.FC<{ lineups?: FixtureLineups }> = ({ lineups }) => {
  if (!lineups?.home || !lineups.away) {
    return <p className="text-sm text-gray-400">No lineups available.</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      {[lineups.home, lineups.away].map((team, index) => (
        <div key={index} className="border border-gray-600 p-3 rounded-md">
          <div className="flex items-center space-x-2">
            <img src={team.team.logo} alt={team.team.name} className="w-6 h-6" />
            <h3 className="font-semibold">{team.team.name}</h3>
          </div>
          <p className="text-sm mt-1">Formation: {team.formation}</p>
          <ul className="mt-2 space-y-1">
            {team.startXI.map((player) => (
              <li key={player.player.id} className="text-sm">{player.player.number}. {player.player.name} ({player.player.pos})</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
};

const StandingsSection: React.FC<{ standings?: LeagueStanding }> = ({ standings }) => {
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
    <div className="mt-0">
      <h3 className="text-lg font-semibold">{standings.league.name} Standings</h3>

      <div className="overflow-x-auto">
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

export default MatchInfo;