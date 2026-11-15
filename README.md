# Dip Buyer — extreme hourly-dip buyer for cbBTC

[![make.fun](https://make.fun/badge/btc-race-24h-20261115-0828.svg)](https://make.fun/bounty/btc-race-24h-20261115-0828)
[![rank](https://make.fun/badge/btc-race-24h-20261115-0828/mshrafi/btc-race-24h-20261115-0828/rank.svg)](https://make.fun/bounty/btc-race-24h-20261115-0828)
[![reward](https://make.fun/badge/btc-race-24h-20261115-0828/mshrafi/btc-race-24h-20261115-0828/reward.svg)](https://make.fun/bounty/btc-race-24h-20261115-0828)

An entry for [Race a BTC trading bot live for 24 hours](https://make.fun/bounty/btc-race-24h-20261115-0828) by [mshrafi](https://github.com/mshrafi) (referral code `7qb8d53t`).

## Strategy

An extreme hourly-dip buyer: long only, one position, 100% of cash per entry. It buys cbBTC when the price has fallen at least 1.80% over the last 60 minutes (scored bars 60–1380, with a 10-bar cooldown after each exit), then exits the full position at +3.50% take profit, −2.50% stop loss, or after 180 bars held. All decisions are pure functions of the closes seen and the account state — no randomness, no clock — using exact bigint arithmetic on the raw integer closes, so two runs on the same data produce identical orders.

## Run

```sh
node cli/makefun.mjs grade-local --kit . --bot <this directory> --driver process
```

(From the kit directory; `--driver process` runs the bot as `node main.ts`.)
