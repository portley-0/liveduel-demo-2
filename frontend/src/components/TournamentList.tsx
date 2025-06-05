import React from "react";
import { Link } from "react-router-dom";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { useTournaments } from "@/context/TournamentContext.tsx";
import { useFilter } from "@/context/FilterContext.tsx";
import { TournamentData } from "@/types/TournamentData.ts";

interface OddsHistory {
  timestamps?: number[];
  teamOdds?: Record<number, number[]>;
}

const areArraysEqual = (a?: number[], b?: number[]) => {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
};

const areOddsRecordsEqual = (a?: Record<number, number[]>, b?: Record<number, number[]>) => {
  if (a === b) return true;
  if (!a || !b) return false;
  const aKeys = Object.keys(a).map(Number);
  const bKeys = Object.keys(b).map(Number);
  if (aKeys.length !== bKeys.length || !aKeys.every((key) => bKeys.includes(key))) {
    return false;
  }
  return aKeys.every((key) => areArraysEqual(a[key], b[key]));
};

// Shared color palette for chart and team percentages
const TEAM_COLORS = [
  "rgba(0, 123, 255, 1)", // Blue
  "rgba(255, 193, 7, 1)", // Yellow
  "rgb(169, 169, 169)", // Gray
  "rgb(225, 29, 72)", // Red
];

const TournamentChart: React.FC<{ oddsHistory: OddsHistory; teamIds: number[] }> = React.memo(
  ({ oddsHistory, teamIds }) => {
    const data = React.useMemo(() => {
      return (oddsHistory?.timestamps || []).map((timestamp, idx) => {
        const result: { timestamp: number; [key: string]: number | undefined } = { timestamp };
        teamIds.forEach((teamId) => {
          const odds = oddsHistory?.teamOdds?.[teamId]?.[idx];
          result[`team${teamId}`] = odds ? 100 / odds : undefined;
        });
        return result;
      });
    }, [oddsHistory, teamIds]);

    const [minY, maxY] = React.useMemo(() => {
      const vals: number[] = [];
      data.forEach((d) => {
        teamIds.forEach((teamId) => {
          const pct = d[`team${teamId}`];
          if (typeof pct === "number") vals.push(pct);
        });
      });
      if (vals.length === 0) return [0, 0];
      return [Math.min(...vals), Math.max(...vals)];
    }, [data, teamIds]);

    const ticks = React.useMemo(() => {
      const latestPcts = teamIds
        .map((teamId) => (data.length ? data[data.length - 1][`team${teamId}`] ?? 0 : 0))
        .filter((pct) => pct > 0);
      return Array.from(new Set(latestPcts)).sort((a, b) => a - b);
    }, [data, teamIds]);

    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ left: 0, right: 11, top: 5, bottom: 10 }}>
          <XAxis dataKey="timestamp" hide />
          <YAxis
            domain={[minY, maxY]}
            allowDecimals
            ticks={ticks}
            tickFormatter={(t) => `${t.toFixed(0)}%`}
            tick={{ fill: "white", fontSize: 7, textAnchor: "end", dx: 10 }}
            tickSize={2}
            width={3}
            axisLine={false}
            tickLine={false}
            orientation="right"
            interval={0}
          />
          {teamIds.map((teamId, index) => (
            <Line
              key={teamId}
              type="linear"
              dataKey={`team${teamId}`}
              stroke={TEAM_COLORS[index % TEAM_COLORS.length]}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    );
  },
  (prevProps, nextProps) => {
    const p = prevProps.oddsHistory,
      n = nextProps.oddsHistory;
    return (
      areArraysEqual(p.timestamps, n.timestamps) &&
      areOddsRecordsEqual(p.teamOdds, n.teamOdds) &&
      areArraysEqual(prevProps.teamIds, nextProps.teamIds)
    );
  }
);

const TournamentList: React.FC = () => {
  const { tournaments } = useTournaments();
  const { selectedLeague, sortBy, deployedOnly } = useFilter();

  if (!tournaments || Object.keys(tournaments).length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex justify-center items-center">
        <span className="loading loading-spinner text-blue-700 h-10 w-10"></span>
      </div>
    );
  }

  const UEFA_LEAGUE_IDS = [2, 3, 848];

  let filteredTournaments = Object.values(tournaments);

  // League filter (using tournamentId as leagueId)
  if (selectedLeague !== null) {
    if (selectedLeague === "uefa") {
      filteredTournaments = filteredTournaments.filter((tournament) =>
        UEFA_LEAGUE_IDS.includes(tournament.tournamentId)
      );
    } else {
      filteredTournaments = filteredTournaments.filter(
        (tournament) => tournament.tournamentId === selectedLeague
      );
    }
  }

  // Deployed filter
  if (deployedOnly) {
    filteredTournaments = filteredTournaments.filter((tournament) => !!tournament.contract);
  }

  // Sorting
  if (sortBy === "volume") {
    filteredTournaments.sort(
      (a, b) => (b.bettingVolume ?? 0) - (a.bettingVolume ?? 0)
    );
  } else if (sortBy === "date-asc") {
    filteredTournaments.sort(
      (a, b) => (a.resolvedAt ?? 0) - (b.resolvedAt ?? 0)
    );
  } else if (sortBy === "date-desc") {
    filteredTournaments.sort(
      (a, b) => (b.resolvedAt ?? 0) - (a.resolvedAt ?? 0)
    );
  }

  const TournamentItem: React.FC<{ tournament: TournamentData }> = ({ tournament }) => {
    // Use tournament.teamIds or fallback to oddsHistory.teamOdds keys
    const teamIds = React.useMemo(() => {
      return tournament.teamIds || (tournament.oddsHistory?.teamOdds ? Object.keys(tournament.oddsHistory.teamOdds).map(Number) : []);
    }, [tournament.teamIds, tournament.oddsHistory]);

    // Get top 8 teams by latest odds, ordered by teamIds
    const topTeams = React.useMemo(() => {
      if (!tournament.latestOdds || !teamIds.length) return [];
      return teamIds
        .map((teamId, index) => {
          const odds = tournament.latestOdds?.[teamId] ?? 0;
          return {
            teamId,
            odds,
            name: tournament.standings?.league.standings
              .flat()
              .find((s) => s.team.id === teamId)?.team.name || `Team ${teamId}`,
            color: TEAM_COLORS[index % TEAM_COLORS.length], // Assign color based on teamIds order
          };
        })
        .filter((team) => team.odds > 0) // Only include teams with valid odds
        .slice(0, Math.min(8, teamIds.length));
    }, [tournament.latestOdds, tournament.standings, teamIds]);

    return (
      <Link
        key={tournament.tournamentId}
        to={`/dashboard/tournaments/${tournament.tournamentId}`}
        className="w-full h-auto aspect-[6/5] block"
      >
        <button
          className="relative group bg-greyblue text-white rounded-xl shadow-md w-full h-full flex flex-col focus:outline-none focus:ring-2 focus:ring-blue-500 active:scale-95 hover:bg-hovergreyblue"
        >
          <div className="p-5 xs:p-6 flex flex-col h-full w-full">
            <div className="relative w-full flex items-center mb-6 lg:mb-6 sm:mb-9 ">
              <div className="bg-white flex items-center justify-center w-[90px] h-[90px] sm:w-[90px] sm:h-[90px] lg:w-[70px] lg:h-[70px] 2xl:w-[70px] 2xl:h-[70px] aspect-square shrink-0 ">
                <img
                  src={tournament.standings?.league.logo || tournament.logo}
                  alt={tournament.name}
                  className="object-contain w-16 h-16 xs:w-[75px] xs:h-[75px] sm:w-[80px] sm:h-[80px] lg:w-14 lg:h-14"
                />
              </div>
              <span className="text-lg xs:text-lg sm:text-xl lg:text-sm font-[Lato-Bold] ml-2">
                {`${tournament.name} Winner`}
              </span>
            </div>
            <div className="bg-lightgreyblue flex-1 min-h-0 max-h-[7.5rem]">
              <TournamentChart
                oddsHistory={
                  tournament.oddsHistory || { timestamps: [], teamOdds: {} }
                }
                teamIds={teamIds}
              />
            </div>
            <div className="flex justify-between items-end mt-2">
              <div className="text-xs sm:text-lg lg:text-xs sm:mt-2 lg:mt-0 font-[Quicksand Bold]">
                <span className="block font-semibold">Volume</span>
                <div className="text-white font-semibold">
                  $
                  {tournament.bettingVolume
                    ? (tournament.bettingVolume / 1_000_000).toFixed(2)
                    : "0.00"}
                </div>
              </div>
              <div className="flex space-x-3 text-xs sm:text-lg lg:text-xs sm:mt-2 lg:mt-0  font-[Quicksand Bold]">
                {topTeams.map((team) => {
                  const pct = team.odds > 0 ? (team.odds * 100).toFixed(0) : "0";
                  return (
                    <div key={team.teamId} className="flex flex-col items-center">
                      <span style={{ color: team.color }} className="font-semibold">
                        {team.name.slice(0, 5).toUpperCase()}
                      </span>
                      <span style={{ color: team.color }} className="font-semibold">
                        {pct}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </button>
      </Link>
    );
  };

  return (
    <div className="w-full grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-6 3xl:grid-cols-7 gap-4 p-4 pb-[80px]">
      {filteredTournaments.map((tournament) => (
        <TournamentItem key={tournament.tournamentId} tournament={tournament} />
      ))}
    </div>
  );
};

export default TournamentList;