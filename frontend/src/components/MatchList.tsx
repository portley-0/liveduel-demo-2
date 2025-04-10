import React from "react";
import { Link } from "react-router-dom";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { useMatches } from "@/context/MatchContext.tsx";
import { useFilter } from "@/context/FilterContext.tsx";
import { LuCirclePlus, LuCircleCheck } from "react-icons/lu";
import { MatchData } from "@/types/MatchData.ts";

interface OddsHistory {
  timestamps?: number[];
  homeOdds?: number[];
  drawOdds?: number[];
  awayOdds?: number[];
}

const areArraysEqual = (a?: number[], b?: number[]) => {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
};

const MatchChart: React.FC<{ oddsHistory: OddsHistory }> = React.memo(
  ({ oddsHistory }) => {
    const data = React.useMemo(() => {
      return (oddsHistory?.timestamps || []).map((timestamp, index) => ({
        timestamp,
        home: oddsHistory?.homeOdds?.[index],
        draw: oddsHistory?.drawOdds?.[index],
        away: oddsHistory?.awayOdds?.[index],
      }));
    }, [oddsHistory]);

    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ left: 0, right: 7, top: 5, bottom: 5 }}>
          <XAxis dataKey="timestamp" hide />
          <YAxis
            domain={[0, 10]}
            allowDecimals
            ticks={[0, 1, 2.5, 5, 7.5, 10]}
            tickFormatter={(tick) => (tick % 1 === 0 ? tick : tick.toFixed(1))}
            tick={{ fill: "white", fontSize: 7, textAnchor: "end", dx: 5 }}
            tickSize={2}
            tickCount={5}
            minTickGap={2}
            interval={0}
            width={3}
            axisLine={false}
            tickLine={false}
            orientation="right"
          />
          <Line type="linear" dataKey="home" stroke="rgba(0, 123, 255, 1)" strokeWidth={2} dot={false}  />
          <Line type="linear" dataKey="draw" stroke="rgba(128, 128, 128, 1)" strokeWidth={2} dot={false}  />
          <Line type="linear" dataKey="away" stroke="rgb(225, 29, 72)" strokeWidth={2} dot={false}  />
        </LineChart>
      </ResponsiveContainer>
    );
  },
  (prevProps, nextProps) => {
    const prev = prevProps.oddsHistory;
    const next = nextProps.oddsHistory;
    return (
      areArraysEqual(prev?.timestamps, next?.timestamps) &&
      areArraysEqual(prev?.homeOdds, next?.homeOdds) &&
      areArraysEqual(prev?.drawOdds, next?.drawOdds) &&
      areArraysEqual(prev?.awayOdds, next?.awayOdds)
    );
  }
);

const MatchList: React.FC = () => {
  const { matches } = useMatches();
  const {
    selectedLeague,
    sortBy,
    liveOnly,
    deployedOnly,
    selectedOnly,
    defaultSelections,
    addDefaultSelection,
  } = useFilter();

  if (!matches || Object.keys(matches).length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex justify-center items-center">
        <span className="loading loading-spinner text-blue-700 h-10 w-10"></span>
      </div>
    );
  }

  const UEFA_LEAGUE_IDS = [2, 3, 848];

  let filteredMatches = Object.values(matches);

  // League filter
  if (selectedLeague !== null) {
    if (selectedLeague === "uefa") {
      filteredMatches = filteredMatches.filter((match) =>
        match.leagueId !== undefined && UEFA_LEAGUE_IDS.includes(match.leagueId)
      );
    } else {
      filteredMatches = filteredMatches.filter(
        (match) => match.leagueId === selectedLeague
      );
    }
  }
  // Deployed filter
  if (deployedOnly) {
    filteredMatches = filteredMatches.filter((match) => !!match.contract);
  }
  // Live filter
  const LIVE_STATUSES = ["1H", "2H", "INT", "BT", "HT", "LIVE", "ET", "P"];
  if (liveOnly) {
    filteredMatches = filteredMatches.filter(
      (match) => match.statusShort && LIVE_STATUSES.includes(match.statusShort)
    );
  }
  // Exclude finalized matches
  filteredMatches = filteredMatches.filter(
    (match) =>
      match.statusShort && !["FT", "AET", "PEN"].includes(match.statusShort)
  );
  // Selected only filter
  if (selectedOnly) {
    const leagueIds = defaultSelections
      .filter((s) => s.type === "league")
      .map((s) => Number(s.id));
    const matchIds = defaultSelections
      .filter((s) => s.type === "match")
      .map((s) => String(s.id));
    filteredMatches = filteredMatches.filter(
      (match) =>
        (match.leagueId && leagueIds.includes(match.leagueId)) ||
        matchIds.includes(String(match.matchId))
    );
  }
  // Sorting
  if (sortBy === "volume") {
    filteredMatches.sort(
      (a, b) => (b.bettingVolume ?? 0) - (a.bettingVolume ?? 0)
    );
  } else if (sortBy === "date-asc") {
    filteredMatches.sort(
      (a, b) => (a.matchTimestamp ?? 0) - (b.matchTimestamp ?? 0)
    );
  } else if (sortBy === "date-desc") {
    filteredMatches.sort(
      (a, b) => (b.matchTimestamp ?? 0) - (a.matchTimestamp ?? 0)
    );
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

  const MatchItem: React.FC<{ match: MatchData }> = ({ match }) => {
    const isMatchIndividuallySelected = defaultSelections.some(
      (selection) => selection.type === "match" && selection.id === match.matchId
    );
    const isLeagueSelectedForMatch = defaultSelections.some(
      (selection) => selection.type === "league" && selection.id === match.leagueId
    );

    const isUefaSelected =
    defaultSelections.some(
      (selection) => selection.type === "league" && selection.id === "uefa"
    ) && match.leagueId !== undefined && UEFA_LEAGUE_IDS.includes(match.leagueId);
    
    const displayCheckIcon = isMatchIndividuallySelected || isLeagueSelectedForMatch || isUefaSelected;

    const homeOddsArray = match.oddsHistory?.homeOdds || [];
    const homeOdds =
      homeOddsArray.length > 0 ? homeOddsArray[homeOddsArray.length - 1] : 3.0;

    const drawOddsArray = match.oddsHistory?.drawOdds || [];
    const drawOdds =
      drawOddsArray.length > 0 ? drawOddsArray[drawOddsArray.length - 1] : 3.0;

    const awayOddsArray = match.oddsHistory?.awayOdds || [];
    const awayOdds =
      awayOddsArray.length > 0 ? awayOddsArray[awayOddsArray.length - 1] : 3.0;

    const [isPlusHovered, setIsPlusHovered] = React.useState(false);

    return (
      <Link
        key={match.matchId}
        to={`/dashboard/markets/${match.matchId}`}
        className="w-full h-auto aspect-[6/5] block"
      >
        <button
          className={`relative group bg-greyblue text-white rounded-xl shadow-md w-full h-full flex flex-col focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            !isPlusHovered ? "active:scale-95 hover:bg-hovergreyblue" : ""
          }`}
        >
          <div
            className="absolute top-1 right-1 z-20"
            style={{ width: "2rem", height: "2rem" }} 
          >
            <button
              onMouseDown={(e) => e.stopPropagation()} 
              onMouseEnter={() => setIsPlusHovered(true)}
              onMouseLeave={() => setIsPlusHovered(false)}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!displayCheckIcon) {
                  addDefaultSelection({
                    id: match.matchId,
                    type: "match",
                    name: `${match.homeTeamName} vs ${match.awayTeamName}`,
                  });
                }
                e.currentTarget.blur();
              }}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (!displayCheckIcon && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  addDefaultSelection({
                    id: match.matchId,
                    type: "match",
                    name: `${match.homeTeamName} vs ${match.awayTeamName}`,
                  });
                }
              }}
              className="w-full h-full flex items-center justify-center cursor-pointer rounded-full bg-transparent" 
              title="Add to selections"
              tabIndex={0}
            >
              {displayCheckIcon ? (
                <LuCircleCheck className="text-blue-500 w-6 h-6" />
              ) : (
                <LuCirclePlus className="text-white w-6 h-6 hover:text-gray-300" />
              )}
            </button>
          </div>


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
                <span
                  className={`text-3xl xs:text-2xl font-bold ${
                    match.statusShort && LIVE_STATUSES.includes(match.statusShort)
                      ? "text-redmagenta"
                      : "text-white"
                  }`}
                >
                  {match.homeScore ?? 0}:{match.awayScore ?? 0}
                </span>
                <span
                  className={`text-xs font-semibold ${
                    match.statusShort && LIVE_STATUSES.includes(match.statusShort)
                      ? "text-redmagenta"
                      : "text-white"
                  }`}
                >
                  {match.statusShort === "PEN"
                    ? "Penalties"
                    : match.statusShort && ["FT", "AET"].includes(match.statusShort)
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
              <MatchChart oddsHistory={match.oddsHistory || { timestamps: [], homeOdds: [], drawOdds: [], awayOdds: [] }} />
            </div>
            <div className="flex justify-between items-end mt-2">
              <div className="text-xs font-[Quicksand Bold]">
                <span className="block font-semibold">Volume</span>
                <div className="text-white font-semibold">
                  $
                  {match.bettingVolume
                    ? (match.bettingVolume / 1_000_000).toFixed(2)
                    : "0.00"}
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
  };

  return (
    <div className="w-full grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-6 3xl:grid-cols-7 gap-4 p-4 pb-[80px]">
      {filteredMatches.map((match) => (
        <MatchItem key={match.matchId} match={match} />
      ))}
    </div>
  );
};

export default MatchList;
