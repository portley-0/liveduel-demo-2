import React from "react";
import { MatchData } from "@/types/MatchData.ts"; 

const FIXED_192x64_SCALING_FACTOR = BigInt("18446744073709551616");

const convertToDecimal = (value: bigint): number => {
  return Number((value * 10000n) / FIXED_192x64_SCALING_FACTOR) / 10000;
};

const Betting: React.FC<{ match: MatchData }> = ({ match }) => {
  // Convert outcome token prices from 192x64 fixed point to decimal
  const homePrice = convertToDecimal(BigInt(match.latestOdds?.home ?? "6148914691236516864"));
  const drawPrice = convertToDecimal(BigInt(match.latestOdds?.draw ?? "6148914691236516864"));
  const awayPrice = convertToDecimal(BigInt(match.latestOdds?.away ?? "6148914691236516864"));

  return (
    <div className="bg-greyblue p-5 rounded-2xl text-white shadow-md mt-10">
      <h2 className="text-xl font-bold">Full Time</h2>
      <p className="mt-2 text-md font-semibold">Bet on {match.homeTeamName} vs {match.awayTeamName}</p>

      <div className="mt-4 flex space-x-4 align-center justify-center">
        <button className="bg-greyblue border-2 border-gray-400 text-white text-2xl font-bold w-[135px] h-[55px] rounded-full">
          {homePrice.toFixed(2)}
        </button>
        <button className="bg-greyblue border-2 border-gray-400 text-white text-2xl font-bold w-[135px] h-[55px] rounded-full">
          {drawPrice.toFixed(2)}
        </button>
        <button className="bg-greyblue border-2 border-gray-400 text-white text-2xl font-bold w-[135px] h-[55px] rounded-full">
          {awayPrice.toFixed(2)}
        </button>
      </div>
    </div>
  );
};

export default Betting;
