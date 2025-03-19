import React, { useState } from "react";
import { MatchData } from "@/types/MatchData.ts";
import { BsArrowDownUp } from "react-icons/bs";
import { RiExpandVerticalSLine } from "react-icons/ri"; 
import { GoArrowUpRight, GoArrowDownRight } from "react-icons/go";
import { TbCircleLetterDFilled } from "react-icons/tb";

const FIXED_192x64_SCALING_FACTOR = BigInt("18446744073709551616");

const convertToDecimal = (value: bigint): number => {
  return Number((value * 10000n) / FIXED_192x64_SCALING_FACTOR) / 10000;
};

const DEFAULT_ODDS = convertToDecimal(BigInt("6148914691236516864"));

const Betting: React.FC<{ match: MatchData }> = ({ match }) => {
  const [selectedBet, setSelectedBet] = useState<"home" | "draw" | "away" | null>(null);
  const [betAmount, setBetAmount] = useState<string>("");
  const [expanded, setExpanded] = useState(false);
  const [tradeType, setTradeType] = useState<"buy" | "sell">("buy"); 

  const homePrice = convertToDecimal(BigInt(match.latestOdds?.home ?? "6148914691236516864"));
  const drawPrice = convertToDecimal(BigInt(match.latestOdds?.draw ?? "6148914691236516864"));
  const awayPrice = convertToDecimal(BigInt(match.latestOdds?.away ?? "6148914691236516864"));

  const prevOdds =
    (match.oddsHistory?.timestamps?.length ?? 0) > 1
      ? {
          home: convertToDecimal(
            BigInt(match.oddsHistory?.homeOdds?.at(-2) ?? match.latestOdds?.home ?? "6148914691236516864")
          ),
          draw: convertToDecimal(
            BigInt(match.oddsHistory?.drawOdds?.at(-2) ?? match.latestOdds?.draw ?? "6148914691236516864")
          ),
          away: convertToDecimal(
            BigInt(match.oddsHistory?.awayOdds?.at(-2) ?? match.latestOdds?.away ?? "6148914691236516864")
          ),
        }
      : { home: DEFAULT_ODDS, draw: DEFAULT_ODDS, away: DEFAULT_ODDS };

  const getOddsMovementIcon = (prev: number, current: number) => {
    if (prev === DEFAULT_ODDS && current === DEFAULT_ODDS) {
      return <BsArrowDownUp className="text-gray-400 text-lg" />;
    }
    if (current > prev) return <GoArrowUpRight className="text-green-400 text-lg" />;
    if (current < prev) return <GoArrowDownRight className="text-red-500 text-lg" />;
    return <BsArrowDownUp className="text-gray-400 text-lg" />;
  };

  return (
    <div className="bg-greyblue p-4 rounded-2xl text-white shadow-md">
      <div className="flex items-center mb-3">
        <h2 className="text-xl font-bold pr-2">Full Time</h2>

        <div className="flex space-x-1">
          <button
            className={`px-1.5 py-0.75 text-[13px] font-semibold border-2 rounded text-white ${
              tradeType === "buy" ? "bg-blue-500 border-blue-700" : "bg-greyblue border-gray-500 hover:bg-hovergreyblue"
            }`}
            onClick={() => setTradeType("buy")}
          >
            BUY
          </button>
          <button
            className={`px-1.5 py-0.75 text-[13px] font-semibold border-2 rounded text-white ${
              tradeType === "sell" ? "bg-red-500 border-red-700" : "bg-greyblue border-gray-500 hover:bg-hovergreyblue"
            }`}
            onClick={() => setTradeType("sell")}
          >
            SELL
          </button>
        </div>
      </div>

      <div className="flex space-x-4 sm:space-x-2 xs:space-x-2 justify-center mb-1">
        {(["home", "draw", "away"] as const).map((outcome) => {
          const price = outcome === "home" ? homePrice : outcome === "draw" ? drawPrice : awayPrice;
          const isSelected = selectedBet === outcome;
          const borderColor =
            isSelected && tradeType === "buy"
              ? "border-blue-500"
              : isSelected && tradeType === "sell"
              ? "border-red-600"
              : "border-gray-400";

          return (
            <button
              key={outcome}
              className={`border-2 shadow-md ${borderColor} text-white font-semibold 
                w-[128px] h-[45px] md:w-[125px] md:h-[43px] sm:w-[117px] sm:h-[42px] 
                xs:w-[107px] xs:h-[40px] min-w-[105px] flex-shrink-0 
                flex items-center justify-center space-x-2 transition-all 
                rounded-full focus:outline-none focus:ring-0 ${
                  isSelected ? "bg-hovergreyblue" : "bg-greyblue hover:bg-hovergreyblue"
                }`}
              onClick={() => setSelectedBet(outcome)}
            >
              {outcome === "draw" ? (
                <TbCircleLetterDFilled className="text-gray-400 text-[35px] md:text-[31px] sm:text-[29px] xs:text-[27px]" />
              ) : (
                <img
                  src={outcome === "home" ? match.homeTeamLogo : match.awayTeamLogo}
                  alt={outcome}
                  className="w-[34px] h-[34px] md:w-[30px] md:h-[30px] sm:w-[28px] sm:h-[28px] xs:w-[26px] xs:h-[26px] object-contain"
                />
              )}
              <span className="text-xl md:text-lg sm:text-base xs:text-sm">${price.toFixed(2)}</span>
              {getOddsMovementIcon(prevOdds[outcome], price)}
            </button>


          );
        })}
      </div>

      {!expanded && (
        <button
          className="w-full mt-2 flex items-center justify-center text-white text-md font-semibold space-x-2"
          onClick={() => setExpanded(true)}
        >
          <RiExpandVerticalSLine className="text-lg" />
          <span>Show Details</span>
        </button>
      )}

      {expanded && (
        <>
          <div className="p-1 w-full">
            <label className="block text-md font-semibold">Enter Outcome Share Amount</label>
            <input
              type="number"
              min="0"
              className="w-full p-2 mt-2 focus:outline-none focus:ring-0 rounded bg-darkblue text-white text-lg"
              placeholder="Enter share amount"
              value={betAmount}
              onChange={(e) => {
                const value = e.target.value.replace(/[^0-9.]/g, ""); 
                setBetAmount(value);
              }}
            />

            <div className="mt-3 text-sm text-white">
              {tradeType === "buy" && <p><strong>Transaction Fee:</strong> 4%</p>}
              <p><strong>Selected Outcome:</strong> {selectedBet ? selectedBet.toUpperCase() : "TBD"}</p>
              <p><strong>Outcome Token Price:</strong> TBD</p>
              <p><strong>{tradeType === "buy" ? "Net Cost" : "USDC Received"}:</strong> TBD</p>
            </div>

            <button
              className={`w-full mt-4 py-2 h-[45px] text-lg font-semibold border-2 rounded-full text-white ${
                tradeType === "buy"
                  ? "bg-blue-500 hover:bg-blue-600 border-blue-700"
                  : "bg-red-500 hover:bg-red-600 border-red-700"
              }`}
            >
              {tradeType === "buy" ? "BUY" : "SELL"}
            </button>
          </div>

          <button
            className="w-full mt-2 flex items-center justify-center text-white text-sm font-semibold space-x-2"
            onClick={() => setExpanded(false)}
          >
            <RiExpandVerticalSLine className="text-lg transform rotate-180" />
            <span>Hide</span>
          </button>
        </>
      )}
    </div>
  );
};

export default Betting;
