#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# redeploy.sh - Full system redeployment
#
# Usage:  pnpm redeploy          (from contracts/)
#         bash scripts/redeploy.sh
#
# Prerequisites:
#   - contracts/.env.enc configured via `pnpm env-enc set`
#   - Chainlink Functions subscription 15388 funded with LINK
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTRACTS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$(cd "$CONTRACTS_DIR/../backend" && pwd)"
CONTRACTS_ENV="$CONTRACTS_DIR/.env"
BACKEND_ENV="$BACKEND_DIR/.env"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log_step()  { echo -e "\n${CYAN}===> $1${NC}"; }
log_ok()    { echo -e "${GREEN}  OK: $1${NC}"; }
log_warn()  { echo -e "${YELLOW}  WARN: $1${NC}"; }

cd "$CONTRACTS_DIR"

# Ensure contracts/.env exists (deploy scripts read/write to it)
if [ ! -f "$CONTRACTS_ENV" ]; then
  touch "$CONTRACTS_ENV"
  log_warn "Created empty contracts/.env"
fi

# --------------------------------------------------------------------------
# Step 1: Compile contracts
# --------------------------------------------------------------------------
log_step "Step 1/7: Compiling contracts..."
pnpm compile
log_ok "Contracts compiled."

# --------------------------------------------------------------------------
# Step 2: Deploy Gnosis CTF (ConditionalTokens, Whitelist, LMSRFactory)
# Whitelist ownership gets transferred to MarketFactory, so a fresh one
# is always needed when redeploying MarketFactory.
# --------------------------------------------------------------------------
log_step "Step 2/7: Deploying Gnosis CTF..."
pnpm deploy:gnosis
log_ok "Gnosis CTF deployed."

# --------------------------------------------------------------------------
# Step 3: Deploy ResultsConsumer (with fresh encrypted secrets)
# --------------------------------------------------------------------------
log_step "Step 3/7: Deploying ResultsConsumer..."
pnpm deploy:resultsconsumer
log_ok "ResultsConsumer deployed."

# --------------------------------------------------------------------------
# Step 4: Deploy Prediction System (MockUSDC, DuelToken, LiquidityPool, MarketFactory)
# --------------------------------------------------------------------------
log_step "Step 4/7: Deploying Prediction System..."
pnpm deploy:system
log_ok "Prediction System deployed."

# --------------------------------------------------------------------------
# Step 5: Deploy RoundConsumer + link to MarketFactory
# --------------------------------------------------------------------------
log_step "Step 5/7: Deploying RoundConsumer + linking to MarketFactory..."
pnpm deploy:roundconsumer
log_ok "RoundConsumer deployed and linked."

# --------------------------------------------------------------------------
# Step 6: Set bot address on MarketFactory
# --------------------------------------------------------------------------
log_step "Step 6/7: Setting bot address..."
pnpm set:botaddress
log_ok "Bot address set."

# --------------------------------------------------------------------------
# Step 7: Sync addresses to backend/.env
# --------------------------------------------------------------------------
log_step "Step 7/7: Syncing contract addresses to backend/.env..."

read_env() {
  local key="$1" file="$2"
  grep "^${key}=" "$file" 2>/dev/null | head -1 | cut -d'=' -f2-
}

write_env() {
  local key="$1" value="$2" file="$3"
  if [ ! -f "$file" ]; then
    echo "${key}=${value}" > "$file"
    return
  fi
  if grep -q "^${key}=" "$file" 2>/dev/null; then
    sed "s|^${key}=.*|${key}=${value}|" "$file" > "$file.tmp" && mv "$file.tmp" "$file"
  else
    echo "${key}=${value}" >> "$file"
  fi
}

MARKET_FACTORY_ADDRESS=$(read_env "MARKET_FACTORY_ADDRESS" "$CONTRACTS_ENV")
CONDITIONAL_TOKENS_ADDRESS=$(read_env "CONDITIONAL_TOKENS_ADDRESS" "$CONTRACTS_ENV")
MOCK_USDC_ADDRESS=$(read_env "MOCK_USDC_ADDRESS" "$CONTRACTS_ENV")

write_env "MARKET_FACTORY_ADDRESS" "$MARKET_FACTORY_ADDRESS" "$BACKEND_ENV"
write_env "CONDITIONAL_TOKENS_ADDRESS" "$CONDITIONAL_TOKENS_ADDRESS" "$BACKEND_ENV"
write_env "USDC_FAUCET_ADDRESS" "$MOCK_USDC_ADDRESS" "$BACKEND_ENV"

log_ok "Backend .env updated."

# --------------------------------------------------------------------------
# Summary
# --------------------------------------------------------------------------
echo ""
echo -e "${GREEN}=========================================="
echo "  DEPLOYMENT COMPLETE"
echo "==========================================${NC}"
echo ""
echo "  CONDITIONAL_TOKENS:  $(read_env 'CONDITIONAL_TOKENS_ADDRESS' "$CONTRACTS_ENV")"
echo "  WHITELIST:           $(read_env 'WHITELIST_ADDRESS' "$CONTRACTS_ENV")"
echo "  LMSR_FACTORY:        $(read_env 'LMSR_MARKET_MAKER_FACTORY_ADDRESS' "$CONTRACTS_ENV")"
echo "  RESULTS_CONSUMER:    $(read_env 'RESULTS_CONSUMER_ADDRESS' "$CONTRACTS_ENV")"
echo "  MOCK_USDC:           $(read_env 'MOCK_USDC_ADDRESS' "$CONTRACTS_ENV")"
echo "  DUEL_TOKEN:          $(read_env 'DUEL_TOKEN_ADDRESS' "$CONTRACTS_ENV")"
echo "  LIQUIDITY_POOL:      $(read_env 'LIQUIDITY_POOL_ADDRESS' "$CONTRACTS_ENV")"
echo "  MARKET_FACTORY:      $(read_env 'MARKET_FACTORY_ADDRESS' "$CONTRACTS_ENV")"
echo "  ROUND_CONSUMER:      $(read_env 'ROUND_CONSUMER_ADDRESS' "$CONTRACTS_ENV")"
echo ""

# --------------------------------------------------------------------------
# Manual reminders
# --------------------------------------------------------------------------
echo -e "${YELLOW}=========================================="
echo "  MANUAL STEPS REQUIRED"
echo "=========================================="
echo ""
echo "  1. Go to https://functions.chain.link/"
echo "     Subscription ID: 15388"
echo ""
echo "     Add NEW consumers:"
echo "       ResultsConsumer: $(read_env 'RESULTS_CONSUMER_ADDRESS' "$CONTRACTS_ENV")"
echo "       RoundConsumer:   $(read_env 'ROUND_CONSUMER_ADDRESS' "$CONTRACTS_ENV")"
echo ""
echo "  2. Remove OLD consumer addresses from the subscription."
echo ""
echo "  3. Verify backend/.env has all non-contract vars"
echo "     (API_KEY, PRIVATE_KEY, AVALANCHE_FUJI_RPC, etc.)"
echo ""
echo "  4. Update frontend/subgraph config if needed."
echo -e "==========================================${NC}"
