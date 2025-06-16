// trade-executor.test.ts
import { ethers } from 'ethers';
import { executeTrade, TradeOrder } from '../src/services/trade-executor'; // Adjust path as needed
import { REBALANCER_PRIVATE_KEY, RPC_URL } from '../src/services/rebalancer.config'; // Adjust path as needed

// Mock ethers.js
jest.mock('ethers', () => ({
  // Use actual ethers for constants like ZeroAddress, BigNumberish
  ...jest.requireActual('ethers'),
  JsonRpcProvider: jest.fn().mockImplementation(() => ({})), // Mock provider
  Wallet: jest.fn().mockImplementation(() => ({ // Mock wallet/signer
    address: '0xMockSignerAddress',
    // Mock connected signer methods like `connect` if necessary, though direct contract interaction is usually preferred
  })),
  Contract: jest.fn().mockImplementation(() => ({ // Mock contract instances
    calcNetCost: jest.fn(),
    approve: jest.fn(),
    trade: jest.fn(),
  })),
}));

describe('trade-executor', () => {
  // Spies to capture console output
  const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

  // Define mock contract instances
  let mockLmsrContract: any;
  let mockUsdcContract: any;
  let mockSigner: any;

  beforeEach(() => {
    jest.clearAllMocks(); // Clear mocks before each test

    // Reset the mock implementation of Contract to get fresh instances for each test
    (ethers.Contract as jest.Mock).mockImplementation((address: string) => {
      if (address === '0xMockLmsrAddress') {
        mockLmsrContract = {
          calcNetCost: jest.fn(),
          trade: jest.fn(),
        };
        return mockLmsrContract;
      } else if (address === '0xMockUsdcAddress') {
        mockUsdcContract = {
          approve: jest.fn(),
        };
        return mockUsdcContract;
      }
      return {}; // Default for other addresses if any
    });

    // Mock the Wallet to control its address and ensure it's connected to a provider
    (ethers.Wallet as jest.Mock).mockImplementation(() => {
      mockSigner = {
        address: '0xMockSignerAddress',
        provider: {}, // Mock provider if the signer interacts with it directly
      };
      return mockSigner;
    });

    // Reset internal mock states
    mockLmsrContract = getContractMockByAddress('0xMockLmsrAddress');
    mockUsdcContract = getContractMockByAddress('0xMockUsdcAddress');
  });

  afterAll(() => {
    // Restore original console methods after all tests are done
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  // Helper to retrieve the specific contract mock instance created by ethers.Contract
  const getContractMockByAddress = (address: string) => {
    const calls = (ethers.Contract as jest.Mock).mock.results;
    for (const call of calls) {
      if (call.value && (ethers.Contract as jest.Mock).mock.calls.find(c => c[0] === address)) {
        return call.value;
      }
    }
    // Fallback in case of re-mocking or direct access needed
    if (address === '0xMockLmsrAddress') return mockLmsrContract;
    if (address === '0xMockUsdcAddress') return mockUsdcContract;
    return undefined;
  };

  it('should successfully execute a trade requiring USDC approval', async () => {
    const tradeOrder: TradeOrder = {
      lmsrAddress: '0xMockLmsrAddress',
      usdcAddress: '0xMockUsdcAddress',
      tradeAmounts: [100, -50, -50],
    };
    const mockNetCost = ethers.parseUnits('100', 6); // 100 USDC (positive cost)

    // Mock calcNetCost to return a positive cost
    mockLmsrContract.calcNetCost.mockResolvedValueOnce(mockNetCost);

    // Mock approve transaction
    mockUsdcContract.approve.mockResolvedValueOnce({
      hash: '0xapproveTxHash',
      wait: jest.fn().mockResolvedValueOnce({ blockNumber: 123, gasUsed: 100000n }),
    });

    // Mock trade transaction
    mockLmsrContract.trade.mockResolvedValueOnce({
      hash: '0xtradeTxHash',
      wait: jest.fn().mockResolvedValueOnce({ blockNumber: 124, gasUsed: 200000n }),
    });

    await executeTrade(tradeOrder);

    expect(mockLmsrContract.calcNetCost).toHaveBeenCalledWith(tradeOrder.tradeAmounts);
    expect(mockUsdcContract.approve).toHaveBeenCalledWith(tradeOrder.lmsrAddress, mockNetCost);
    expect(mockLmsrContract.trade).toHaveBeenCalledWith(tradeOrder.tradeAmounts, mockNetCost);
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('USDC approval successful.'));
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Trade confirmed!'));
  });

  it('should successfully execute a trade not requiring USDC approval (negative net cost)', async () => {
    const tradeOrder: TradeOrder = {
      lmsrAddress: '0xMockLmsrAddress',
      usdcAddress: '0xMockUsdcAddress',
      tradeAmounts: [-100, 50, 50],
    };
    const mockNetCost = ethers.parseUnits('-50', 6); // -50 USDC (negative cost = payout)

    mockLmsrContract.calcNetCost.mockResolvedValueOnce(mockNetCost);
    mockLmsrContract.trade.mockResolvedValueOnce({
      hash: '0xtradeTxHashNegative',
      wait: jest.fn().mockResolvedValueOnce({ blockNumber: 125, gasUsed: 150000n }),
    });

    await executeTrade(tradeOrder);

    expect(mockLmsrContract.calcNetCost).toHaveBeenCalledWith(tradeOrder.tradeAmounts);
    expect(mockUsdcContract.approve).not.toHaveBeenCalled(); // No approval needed
    expect(mockLmsrContract.trade).toHaveBeenCalledWith(tradeOrder.tradeAmounts, mockNetCost);
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Net cost is zero or negative. No approval needed.'));
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Trade confirmed!'));
  });

  it('should handle errors during calcNetCost', async () => {
    const tradeOrder: TradeOrder = {
      lmsrAddress: '0xMockLmsrAddress',
      usdcAddress: '0xMockUsdcAddress',
      tradeAmounts: [10, 0, -10],
    };
    const error = new Error('Revert: Invalid trade amounts');
    mockLmsrContract.calcNetCost.mockRejectedValueOnce(error);

    await expect(executeTrade(tradeOrder)).rejects.toThrow(error);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('An error occurred during trade execution:'),
      error.message
    );
    expect(mockUsdcContract.approve).not.toHaveBeenCalled();
    expect(mockLmsrContract.trade).not.toHaveBeenCalled();
  });

  it('should handle errors during USDC approval', async () => {
    const tradeOrder: TradeOrder = {
      lmsrAddress: '0xMockLmsrAddress',
      usdcAddress: '0xMockUsdcAddress',
      tradeAmounts: [100, -50, -50],
    };
    const mockNetCost = ethers.parseUnits('100', 6);
    const approvalError = new Error('User denied transaction');

    mockLmsrContract.calcNetCost.mockResolvedValueOnce(mockNetCost);
    mockUsdcContract.approve.mockRejectedValueOnce(approvalError);

    await expect(executeTrade(tradeOrder)).rejects.toThrow(approvalError);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('An error occurred during trade execution:'),
      approvalError.message
    );
    expect(mockLmsrContract.trade).not.toHaveBeenCalled();
  });

  it('should handle errors during trade execution', async () => {
    const tradeOrder: TradeOrder = {
      lmsrAddress: '0xMockLmsrAddress',
      usdcAddress: '0xMockUsdcAddress',
      tradeAmounts: [100, -50, -50],
    };
    const mockNetCost = ethers.parseUnits('100', 6);
    const tradeError = new Error('LMSR: Cannot trade zero shares');

    mockLmsrContract.calcNetCost.mockResolvedValueOnce(mockNetCost);
    mockUsdcContract.approve.mockResolvedValueOnce({
      hash: '0xapproveTxHash',
      wait: jest.fn().mockResolvedValueOnce({ blockNumber: 123, gasUsed: 100000n }),
    });
    mockLmsrContract.trade.mockRejectedValueOnce(tradeError);

    await expect(executeTrade(tradeOrder)).rejects.toThrow(tradeError);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('An error occurred during trade execution:'),
      tradeError.message
    );
  });

  it('should log specific Ethers.js reasons if available', async () => {
    const tradeOrder: TradeOrder = {
      lmsrAddress: '0xMockLmsrAddress',
      usdcAddress: '0xMockUsdcAddress',
      tradeAmounts: [10, 0, -10],
    };
    const ethersErrorWithReason: any = new Error('Transaction reverted');
    ethersErrorWithReason.reason = 'Insufficient funds'; // Add a reason property
    mockLmsrContract.calcNetCost.mockRejectedValueOnce(ethersErrorWithReason);

    await expect(executeTrade(tradeOrder)).rejects.toThrow(ethersErrorWithReason);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'EXECUTOR: Trade execution failed with reason: "Insufficient funds"'
    );
  });
});
