// Extreme hourly-dip buyer for cbBTC (CBBTC/USDC), 1-minute bars.
//
// Strategy: long only, one position, 100% of cash per entry.
//   ENTRY (flat, scored bar index 60..1380, >= 10 bars since last exit):
//     close[i] / close[i-60] - 1 <= -1.80%  (cbBTC fell at least 180 bps
//     over the last 60 minutes) -> buy with all available cash.
//   EXIT (while holding, checked on every close; sell the full qty):
//     mark >= cost * 1.0350 (take profit +350 bps) OR
//     mark <= cost * 0.9750 (stop loss -250 bps) OR
//     bars held >= 180 (time exit).
// Mark is the position valued at the latest close; cost is the position's
// cost_quote_units (sum of buy notionals, fees included).
//
// All decisions are pure functions of the closes seen and the account
// state: no randomness, no clock, no environment reads, so two runs on
// the same data produce identical orders. All comparisons are exact
// bigint arithmetic on the raw integer closes (price_scale 5), so no
// float rounding can flip a threshold.
//
// Closes are recorded on every batch, warm-up included, and the index i
// below counts closes in the order seen. On this competition the hello
// carries no warmup_bars, so i is the scored-window bar index directly.

import { runBars } from './vendor/makefun-bars.ts';
import type { BarsState, Batch, OrderInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';
const MAX_SLIPPAGE_BPS = 10_000;

// Entry: 60-bar lookback, drop of at least 180 bps:
//   close[i] * 10000 <= close[i-60] * 9820
const LOOKBACK = 60;
const ENTRY_NUM = 9820n;
const ENTRY_DEN = 10_000n;
const ENTRY_MIN_INDEX = 60;
const ENTRY_MAX_INDEX = 1380;
const COOLDOWN_BARS = 10;

// Exit: take profit +350 bps, stop loss -250 bps, time exit 180 bars held.
const TP_NUM = 10_350n;
const SL_NUM = 9750n;
const BPS_DEN = 10_000n;
const MAX_HOLD_BARS = 180;

const closes: bigint[] = [];
let entryBar = -1; // stream index of the bar the entry was decided on
let lastExitBar = -1; // stream index of the bar the last exit was decided on

function onBatch(state: BarsState, _batch: Batch): OrderInput[] {
  const close = state.close(SYMBOL);
  if (close === null) return [];
  closes.push(close);
  const i = closes.length - 1;

  if (state.warmingUp) return [];

  const pos = state.positions.get(SYMBOL);
  const qty = pos?.qty ?? 0n;

  if (qty > 0n && pos !== undefined) {
    // Holding: check exits on this close.
    const mark = state.value(SYMBOL, qty, close);
    const cost = pos.cost;
    const held = i - entryBar;
    if (
      mark * BPS_DEN >= cost * TP_NUM ||
      mark * BPS_DEN <= cost * SL_NUM ||
      held >= MAX_HOLD_BARS
    ) {
      lastExitBar = i;
      entryBar = -1;
      return [{ side: 'sell', symbol: SYMBOL, qty, max_slippage_bps: MAX_SLIPPAGE_BPS }];
    }
    return [];
  }

  // Entry gate: the scored-window index (seq minus any warm-up batches)
  // must be 60..1380, so the 60-bar lookback always has closes to read
  // and no entry is opened in the last hour, when a 180-bar hold could
  // not play out. The 10-bar cooldown counts from the bar the last exit
  // was decided on: an entry is allowed once i - lastExitBar >= 10.
  const scoredIndex = state.seq - state.warmupBars;
  if (scoredIndex < ENTRY_MIN_INDEX || scoredIndex > ENTRY_MAX_INDEX) return [];
  if (lastExitBar >= 0 && i - lastExitBar < COOLDOWN_BARS) return [];
  if (closes.length <= LOOKBACK) return [];
  const now = closes[i]!;
  const hourAgo = closes[i - LOOKBACK]!;
  if (now * ENTRY_DEN > hourAgo * ENTRY_NUM) return []; // drop smaller than 180 bps

  const room = state.weightRoom(SYMBOL);
  let notional = state.cash < room ? state.cash : room;
  const minNotional = BigInt(state.hello.fees.min_notional_quote_units);
  if (notional < minNotional) return [];
  if (notional <= 0n) return [];
  entryBar = i;
  return [{ side: 'buy', symbol: SYMBOL, notional_quote_units: notional, max_slippage_bps: MAX_SLIPPAGE_BPS }];
}

await runBars({
  onBatch,
});
