import React from "react";
import { Link } from "react-router-dom";
import { useMatches } from "@/context/MatchContext.tsx";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";

// 192x64 Fixed-Point Scaling Factor (BigInt for Ethers v6)
const FIXED_192x64_SCALING_FACTOR = BigInt("18446744073709551616");

// Convert 192x64 fixed-point to decimal probability
const convertToDecimal = (value: bigint): number => {
  return Number((value * 10000n) / FIXED_192x64_SCALING_FACTOR) / 10000;
};

// Convert decimal probability to decimal odds (1 / probability)
const convertToDecimalOdds = (probability: number): number => {
  return probability > 0 ? 1 / probability : 10.0; // Prevent division by zero, default max 10.0 odds
};

// Generate default flatline odds history if none exists
const generateFlatlineOdds = () => {
  const now = Date.now();
  return {
    timestamps: Array.from({ length: 10 }, (_, i) => now - i * 60000), // 10 timestamps, 1 min apart
    homeOdds: Array(10).fill(FIXED_192x64_SCALING_FACTOR / 3n), // Default 0.33
    drawOdds: Array(10).fill(FIXED_192x64_SCALING_FACTOR / 3n),
    awayOdds: Array(10).fill(FIXED_192x64_SCALING_FACTOR / 3n),
  };
};

// Props Interface
interface MatchListProps {
  selectedLeague: number | null;
  sortBy: string;
  liveOnly: boolean;
}

const MatchList: React.FC<MatchListProps> = ({ selectedLeague, sortBy, liveOnly }) => {
  const { matches } = useMatches();

  if (!matches || Object.keys(matches).length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <span className="loading loading-spinner text-blue-700 h-10 w-10"></span>
      </div>
    );
  }

  // Apply filters
  let filteredMatches = Object.values(matches);

  if (selectedLeague !== null) {
    filteredMatches = filteredMatches.filter((match) => match.leagueId === selectedLeague);
  }

  if (liveOnly) {
    filteredMatches = filteredMatches.filter((match) => match.statusShort === "LIVE");
  }

  // Apply sorting
  if (sortBy === "volume") {
    filteredMatches.sort((a, b) => (b.bettingVolume ?? 0) - (a.bettingVolume ?? 0));
  } else if (sortBy === "date-asc") {
    filteredMatches.sort((a, b) => (a.matchTimestamp ?? 0) - (b.matchTimestamp ?? 0));
  } else if (sortBy === "date-desc") {
    filteredMatches.sort((a, b) => (b.matchTimestamp ?? 0) - (a.matchTimestamp ?? 0));
  }

  return (
    <div className="w-full grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4">
      {filteredMatches.map((match) => {
        const oddsData = match.oddsHistory?.timestamps?.length ? match.oddsHistory : generateFlatlineOdds();

        // Format data for Recharts (Convert to Decimal Odds)
        const formattedData = oddsData.timestamps.map((timestamp: number, index: number) => {
          const homeProbability = convertToDecimal(BigInt(oddsData.homeOdds[index]));
          const drawProbability = convertToDecimal(BigInt(oddsData.drawOdds[index]));
          const awayProbability = convertToDecimal(BigInt(oddsData.awayOdds[index]));

          return {
            time: new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            home: convertToDecimalOdds(homeProbability),
            draw: convertToDecimalOdds(drawProbability),
            away: convertToDecimalOdds(awayProbability),
          };
        });

        // Get latest odds values
        const lastIndex = oddsData.homeOdds.length - 1;
        const homePrice = convertToDecimal(BigInt(oddsData.homeOdds[lastIndex]));
        const drawPrice = convertToDecimal(BigInt(oddsData.drawOdds[lastIndex]));
        const awayPrice = convertToDecimal(BigInt(oddsData.awayOdds[lastIndex]));

        return (
          <Link
            key={match.matchId}
            to={`/dashboard/markets/${match.matchId}`}
            className="relative group transition-all duration-300 ease-in-out hover:bg-hovergreyblue bg-greyblue text-white rounded-xl shadow-md w-full h-auto aspect-[6/5] p-0 flex flex-col"
          >
            <div className="p-5 flex flex-col h-full">
              <div className="flex justify-between items-center mb-4">
                <div className="flex flex-col">
                  <img src={match.homeTeamLogo} alt={match.homeTeamName} className="object-contain mb-1 w-20 h-20 sm:w-14 sm:h-14" />
                  <span className="text-lg sm:text-xs font-[Lato-Bold] mt-1">{match.homeTeamName}</span>
                </div>
                <div className="absolute left-1/2 transform -translate-x-1/2 -translate-y-2 flex flex-col items-center">
                  <span className="text-3xl sm:text-xl font-bold text-red-500">
                    {match.homeScore ?? 0}:{match.awayScore ?? 0}
                  </span>
                  <span className="text-xs text-red-500 text-semibold">
                    {match.statusShort === "LIVE" ? `⚡In Progress (${match.elapsed ?? 0}’)` : "Upcoming"}
                  </span>
                </div>
                <div className="flex flex-col items-end">
                  <img src={match.awayTeamLogo} alt={match.awayTeamName} className="object-contain mb-1 w-20 h-20 sm:w-14 sm:h-14" />
                  <span className="text-lg sm:text-xs font-[Lato-Bold] mt-1">{match.awayTeamName}</span>
                </div>
              </div>

              {/* Lightweight Odds Graph using Recharts */}
              <div className="bg-lightgreyblue h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={formattedData} margin={{ left: 0, right: 5, top: 5, bottom: 5 }}>
                    <XAxis dataKey="time" hide />
                    <YAxis
                      domain={[0, 10]}
                      ticks={[0, 1, 2.5, 5, 7.5, 10]} // Ensure all levels are shown
                      tick={{ fill: "white", fontSize: 10, textAnchor: "end" }}
                      tickSize={6} // Ensures proper spacing for each level
                      width={3} // Increase width for proper visibility
                      axisLine={false} // Removes axis bracket
                      tickLine={false} // Removes tick lines
                      orientation="right" // Moves Y-axis fully to the right
                    />
                    <Line type="monotone" dataKey="home" stroke="rgba(0, 123, 255, 1)" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="draw" stroke="rgba(128, 128, 128, 1)" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="away" stroke="rgba(220, 53, 69, 1)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="flex justify-between items-end mt-2">
                <div className="text-xs font-[Quicksand Bold]">
                  <span className="block font-semibold">Volume</span>
                  <div className="text-white font-semibold">${match.bettingVolume?.toLocaleString() ?? "0"}</div>
                </div>
                <div className="flex space-x-4 text-xs font-[Quicksand Bold]">
                  <div className="flex flex-col items-center">
                    <span className="text-blue-400 font-semibold">$HOME</span>
                    <span className="text-blue-400 font-semibold">{homePrice.toFixed(4)}</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-gray-400 font-semibold">$DRAW</span>
                    <span className="text-gray-400 font-semibold">{drawPrice.toFixed(4)}</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-red-500 font-semibold">$AWAY</span>
                    <span className="text-red-500 font-semibold">{awayPrice.toFixed(4)}</span>
                  </div>
                </div>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
};

export default MatchList;