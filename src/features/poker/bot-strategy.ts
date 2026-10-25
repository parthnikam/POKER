import { estimateEquity, formatChips } from "@/lib/poker";
import { botProfiles, type GameState } from "./model";

export function runBotTurn(current: GameState, botId: string): GameState {
  const players = current.players.map((player) => ({ ...player }));
  const bot = players.find((player) => player.id === botId);
  if (!bot || bot.folded) return current;

  const stageBoardCount = current.stage === "preflop" ? 0 : current.stage === "flop" ? 3 : current.stage === "turn" ? 4 : 5;
  const board = current.board.slice(0, stageBoardCount);
  const profile = botProfiles.find((item) => item.id === botId);
  if (!profile) return current;

  const gap = Math.max(0, current.currentBet - (current.streetContributions[bot.id] ?? 0));
  const equity = estimateEquity(players, board, 120, bot.id).shares[players.indexOf(bot)];
  const potOdds = gap > 0 ? gap / (current.pot + gap) : 0;
  const scaryBoard = board.filter((card) => card.rank >= 11).length >= 2;
  const bluffChance = Math.max(
    0,
    profile.bluffRate + (scaryBoard ? 0.08 : 0) + (current.stage === "river" ? -0.04 : 0),
  );
  const canRaise = current.raisesThisStreet < 2 && bot.stack > gap + 10;
  const isProfitableCall = equity + profile.callMargin >= potOdds;
  const canValueRaise = equity >= Math.max(0.58, potOdds + 0.18);
  const canBluffRaise = equity < 0.38 && Math.random() < bluffChance * 0.45;
  const isBluff = equity < profile.betThreshold;
  const shouldAggress = canRaise && (gap > 0
    ? (canValueRaise || canBluffRaise) && Math.random() < (canValueRaise ? 0.42 : 0.72)
    : equity >= profile.betThreshold || (equity >= 0.22 && Math.random() < bluffChance));
  const decision = gap > 0
    ? !isProfitableCall && !canBluffRaise ? "fold" : shouldAggress ? "raise" : "call"
    : current.currentBet > 0 ? "check"
      : shouldAggress ? isBluff ? "bluff" : "bet" : "check";

  let pot = current.pot;
  let currentBet = current.currentBet;
  let raisesThisStreet = current.raisesThisStreet;
  const streetContributions = { ...current.streetContributions };
  const putChipsIn = (amount: number) => {
    const payment = Math.min(amount, bot.stack);
    bot.stack -= payment;
    streetContributions[bot.id] = (streetContributions[bot.id] ?? 0) + payment;
    pot += payment;
    return payment;
  };

  if (decision === "fold") {
    bot.folded = true;
    bot.lastAction = "FOLD";
  } else if (decision === "check") {
    bot.lastAction = "CHECK";
  } else if (decision === "call") {
    bot.lastAction = `CALL ${formatChips(putChipsIn(gap))}`;
  } else {
    const raiseSize = Math.min(
      Math.max(20, Math.round((pot * 0.45) / 10) * 10),
      Math.max(0, bot.stack - gap),
    );
    const payment = putChipsIn(gap + raiseSize);
    currentBet = streetContributions[bot.id];
    raisesThisStreet += 1;
    bot.lastAction = `${decision === "bluff" ? "BLUFF" : decision === "bet" ? "BET" : "RAISE"} ${formatChips(payment)}`;
  }

  return {
    ...current,
    players,
    pot,
    currentBet,
    streetContributions,
    raisesThisStreet,
    actionLog: [...current.actionLog, `${bot.name} ${bot.lastAction.toLowerCase()}`],
  };
}
