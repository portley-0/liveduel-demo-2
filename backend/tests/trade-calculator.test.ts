import { calculateOptimalTrade, OptimalTrade, MarketState, MarketOdds } from '../src/services/trade-calculator';

const ENABLE_CONSOLE_LOGS = true;

const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation((...args) => {
  if (ENABLE_CONSOLE_LOGS) {
    jest.requireActual('console').log(...args);
  }
});

describe('trade-calculator (Unit Tests)', () => {

  const createMarketState = (q: [bigint, bigint, bigint], b: bigint): MarketState => ({ q, b });
  const createMarketOdds = (home: number, draw: number, away: number): MarketOdds => ({ home, draw, away });

  afterAll(() => {
    consoleLogSpy.mockRestore();
  });

  describe('calculateOptimalTrade', () => {

    it('should return no profitable trade when on-chain odds are already close to target odds', () => {
      const marketState: MarketState = createMarketState([100_000_000n, 100_000_000n, 100_000_000n], 300_000_000n);
      const targetOdds: MarketOdds = createMarketOdds(3.0, 3.0, 3.0);
      const result = calculateOptimalTrade(marketState, targetOdds);
      expect(result.hasProfitableTrade).toBe(false);
      expect(result.tradeAmounts).toBeUndefined();
    });

    it('should find a profitable trade when on-chain odds diverge significantly from target odds', () => {
      const marketState: MarketState = createMarketState([200_000_000n, 80_000_000n, 50_000_000n], 300_000_000n);
      const targetOdds: MarketOdds = createMarketOdds(2.5, 1 / 0.35, 4.0);
      const result = calculateOptimalTrade(marketState, targetOdds);
      expect(result.hasProfitableTrade).toBe(true);
      expect(result.tradeAmounts).toBeDefined();
      if (result.tradeAmounts) {
        expect(result.tradeAmounts[0]).toBeGreaterThan(0);
        expect(result.tradeAmounts[1]).toBeLessThan(0);
        expect(result.tradeAmounts[2]).toBeLessThan(0);
      }
    });

    it('should handle zero funding (b=0) gracefully', () => {
      const marketState: MarketState = createMarketState([100_000_000n, 100_000_000n, 100_000_000n], 0n);
      const targetOdds: MarketOdds = createMarketOdds(2.0, 3.0, 4.0);
      const result = calculateOptimalTrade(marketState, targetOdds);
      expect(result.hasProfitableTrade).toBe(false);
      expect(result.tradeAmounts).toBeUndefined();
    });

    it('should calculate trade for a market with very low initial quantity on one outcome', () => {
      const marketState: MarketState = createMarketState([1_000_000n, 100_000_000n, 100_000_000n], 200_000_000n);
      const targetOdds: MarketOdds = createMarketOdds(2.0, 3.0, 4.0);
      const result = calculateOptimalTrade(marketState, targetOdds);
      expect(result.hasProfitableTrade).toBe(true);
      expect(result.tradeAmounts).toBeDefined();
      if (result.tradeAmounts) {
        expect(result.tradeAmounts[0]).toBeLessThanOrEqual(0);
      }
    });

    it('should calculate large trade amounts for significant market divergence', () => {
      const marketState: MarketState = createMarketState([100_000_000n, 100_000_000n, 100_000_000n], 300_000_000n);
      const targetOdds: MarketOdds = createMarketOdds(1.2, 10.0, 10.0);
      const result = calculateOptimalTrade(marketState, targetOdds);
      expect(result.hasProfitableTrade).toBe(true);
      expect(result.tradeAmounts).toBeDefined();
      if (result.tradeAmounts) {
        expect(result.tradeAmounts[0]).toBeGreaterThan(0);
        expect(result.tradeAmounts[1]).toBeLessThan(0);
        expect(result.tradeAmounts[2]).toBeLessThan(0);
      }
    });

    it('should correctly model a market funded with 15,000 USDC', () => {
      const usdcFundingAmount = 15000n * 1_000_000n; 

      const outcomeTokenQuantity = 15000000000n; 

      const marketState: MarketState = createMarketState(
        [outcomeTokenQuantity, outcomeTokenQuantity, outcomeTokenQuantity],
        usdcFundingAmount
      );

      const targetOdds: MarketOdds = createMarketOdds(2.0, 4.0, 4.0);

      const result = calculateOptimalTrade(marketState, targetOdds);

      console.log('Trade amounts for 15k USDC market:', result.tradeAmounts);

      expect(result.hasProfitableTrade).toBe(true);
      expect(result.tradeAmounts).toBeDefined();

      if (result.tradeAmounts) {
        const [homeTrade, drawTrade, awayTrade] = result.tradeAmounts;

        expect(homeTrade).toBeGreaterThan(0);
        expect(drawTrade).toBeLessThan(0);
        expect(drawTrade).toEqual(awayTrade);
      }
    });
  });
});