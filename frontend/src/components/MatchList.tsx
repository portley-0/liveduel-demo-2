import React from "react";
import { Link } from "react-router-dom";
import { useMatches } from "@/context/MatchContext.tsx";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from "recharts";

interface MatchListProps {
  selectedLeague: number | null;
  sortBy: string;
  liveOnly: boolean;
}

const MatchList: React.FC<MatchListProps> = ({
  selectedLeague,
  sortBy,
  liveOnly,
}) => {
  const { matches } = useMatches();

  if (!matches || Object.keys(matches).length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex justify-center items-center">
        <span className="loading loading-spinner text-blue-700 h-10 w-10"></span>
      </div>
    );
  }

  let filteredMatches = Object.values(matches);

  if (selectedLeague !== null) {
    filteredMatches = filteredMatches.filter(
      (match) => match.leagueId === selectedLeague
    );
  }

  const LIVE_STATUSES = ["1H", "2H", "INT", "BT", "HT", "LIVE", "ET", "P"];

  if (liveOnly) {
    filteredMatches = filteredMatches.filter(
      (match) => match.statusShort && LIVE_STATUSES.includes(match.statusShort)
    );
  }

  if (sortBy === "volume") {
    filteredMatches.sort((a, b) => (b.bettingVolume ?? 0) - (a.bettingVolume ?? 0));
  } else if (sortBy === "date-asc") {
    filteredMatches.sort((a, b) => (a.matchTimestamp ?? 0) - (b.matchTimestamp ?? 0));
  } else if (sortBy === "date-desc") {
    filteredMatches.sort((a, b) => (b.matchTimestamp ?? 0) - (a.matchTimestamp ?? 0));
  }

  const formatKickoffTime = (timestamp?: number) => {
    if (!timestamp) return "TBD";
    return new Date(timestamp * 1000).toLocaleString([], {
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  return (
    <div className="w-full grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-6 3xl:grid-cols-7 gap-4 p-4 pb-[80px]">
      {filteredMatches.map((match) => {

      const homeOddsArray = match.oddsHistory?.homeOdds || [];
      const homeOdds = homeOddsArray.length > 0 ? homeOddsArray[homeOddsArray.length - 1] : 3.0;

      const drawOddsArray = match.oddsHistory?.drawOdds || [];
      const drawOdds = drawOddsArray.length > 0 ? drawOddsArray[drawOddsArray.length - 1] : 3.0;

      const awayOddsArray = match.oddsHistory?.awayOdds || [];
      const awayOdds = awayOddsArray.length > 0 ? awayOddsArray[awayOddsArray.length - 1] : 3.0;


        return (
          <Link
            key={match.matchId}
            to={`/dashboard/markets/${match.matchId}`}
            className="w-full h-auto aspect-[6/5] block"
          >
            <button className="relative group bg-greyblue text-white rounded-xl shadow-md w-full h-full flex flex-col hover:bg-hovergreyblue active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-500">
              <div className="p-5 xs:p-6 flex flex-col h-full w-full">
                <div className="relative w-full flex items-center justify-between mb-3">
                  <div className="flex flex-col">
                    <img
                      src={match.homeTeamLogo}
                      alt={match.homeTeamName}
                      className="object-contain w-16 h-16 xs:w-[75px] xs:h-[75px] sm:w-[80px] sm:h-[80px] lg:w-14 lg:h-14"
                    />
                    <span className="text-sm xs:text-lg sm:text-lg lg:text-sm font-[Lato-Bold] mt-1 mb-1 truncate max-w-[140px]">
                      {match.homeTeamName}
                    </span>
                  </div>
                  <div className="absolute left-1/2 transform -translate-x-1/2 -translate-y-2 flex flex-col items-center">
                    <span className="text-3xl xs:text-2xl font-bold text-redmagenta">
                      {match.homeScore ?? 0}:{match.awayScore ?? 0}
                    </span>
                    <span className="text-xs text-redmagenta font-semibold">
                      {match.statusShort && ["FT", "AET", "PEN"].includes(match.statusShort)
                        ? "Full Time"
                        : match.statusShort && LIVE_STATUSES.includes(match.statusShort)
                        ? `In Progress (${match.elapsed}’)`
                        : formatKickoffTime(match.matchTimestamp)}
                    </span>
                  </div>
                  <div className="flex flex-col items-end">
                    <img
                      src={match.awayTeamLogo}
                      alt={match.awayTeamName}
                      className="object-contain w-16 h-16 xs:w-[75px] xs:h-[75px] sm:w-[80px] sm:h-[80px] lg:w-14 lg:h-14"
                    />
                    <span className="text-sm xs:text-lg sm:text-lg lg:text-sm font-[Lato-Bold] mt-1 mb-1 truncate max-w-[140px]">
                      {match.awayTeamName}
                    </span>
                  </div>
                </div>
                <div className="bg-lightgreyblue flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={(match.oddsHistory?.timestamps || []).map((timestamp, index) => ({
                        timestamp,
                        home: match.oddsHistory?.homeOdds[index],
                        draw: match.oddsHistory?.drawOdds[index],
                        away: match.oddsHistory?.awayOdds[index],
                      })) ?? []}
                      margin={{ left: 0, right: 7, top: 5, bottom: 5 }}
                    >
                      <XAxis dataKey="timestamp" hide />
                      <YAxis
                        domain={[0, 10]}
                        allowDecimals
                        ticks={[0, 1, 2.5, 5, 7.5, 10]}
                        tickFormatter={(tick) => (tick % 1 === 0 ? tick : tick.toFixed(1))}
                        tick={{
                          fill: "white",
                          fontSize: 7,
                          textAnchor: "end",
                          dx: 5,
                        }}
                        tickSize={2}
                        tickCount={5}
                        minTickGap={2}
                        interval={0}
                        width={3}
                        axisLine={false}
                        tickLine={false}
                        orientation="right"
                      />
                      <Line type="linear" dataKey="home" stroke="rgba(0, 123, 255, 1)" strokeWidth={2} dot={false} />
                      <Line type="linear" dataKey="draw" stroke="rgba(128, 128, 128, 1)" strokeWidth={2} dot={false} />
                      <Line type="linear" dataKey="away" stroke="rgb(225, 29, 72)" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex justify-between items-end mt-2">
                  <div className="text-xs font-[Quicksand Bold]">
                    <span className="block font-semibold">Volume</span>
                    <div className="text-white font-semibold">
                      ${match.bettingVolume ? (match.bettingVolume / 1_000_000).toFixed(2) : "0.00"}
                    </div>
                  </div>
                  <div className="flex space-x-4 text-xs font-[Quicksand Bold]">
                    <div className="flex flex-col items-center">
                      <span className="text-blue-400 font-semibold">$HOME</span>
                      <span className="text-blue-400 font-semibold">
                        {homeOdds.toFixed(1)}
                      </span>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-gray-400 font-semibold">$DRAW</span>
                      <span className="text-gray-400 font-semibold">
                        {drawOdds.toFixed(1)}
                      </span>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-redmagenta font-semibold">$AWAY</span>
                      <span className="text-redmagenta font-semibold">
                        {awayOdds.toFixed(1)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </button>
          </Link>
        );
      })}
    </div>
  );
};

export default MatchList;
