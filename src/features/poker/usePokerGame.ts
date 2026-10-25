"use client";

import { useEffect, useMemo, useState } from "react";
import {
  estimateEquity,
  estimateOuts,
  evaluateHand,
  formatChips,
  handNames,
} from "@/lib/poker";
import { runBotTurn } from "./bot-strategy";
import {
  botProfiles,
  createHand,
  createHistoryEntry,
  findWinners,
  heroId,
  historyStorageKey,
  isHistoryEntry,
  splitPot,
  stageNames,
  type GameState,
  type HistoryEntry,
  type PayoutFlight,
} from "./model";

export function usePokerGame() {
  const [game, setGame] = useState<GameState | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState("");
  const [payoutFlights, setPayoutFlights] = useState<PayoutFlight[]>([]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = window.localStorage.getItem(historyStorageKey);
        if (saved) {
          const parsed: unknown = JSON.parse(saved);
          if (!Array.isArray(parsed)) throw new Error("Saved hand history is not a list.");
          setHistory(parsed.filter(isHistoryEntry));
        }
      } catch (error) {
        console.error("Could not load saved poker history.", error);
        setToast("Saved history could not be loaded in this browser.");
      }
      setGame(createHand(1000));
      setReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(historyStorageKey, JSON.stringify(history));
    } catch (error) {
      console.error("Could not save poker history.", error);
      window.setTimeout(() => setToast("Your browser could not save this session's history."), 0);
    }
  }, [history, ready]);

  const visibleCount = game ? game.finished ? 5 : game.visibleBoardCount : 0;
  const visibleBoard = useMemo(() => game?.board.slice(0, visibleCount) ?? [], [game, visibleCount]);
  const equity = useMemo(
    () => (game ? estimateEquity(game.players, visibleBoard, game.stage === "preflop" ? 180 : 200) : null),
    [game, visibleBoard],
  );
  const heroIndex = game?.players.findIndex((player) => player.id === heroId) ?? 0;
  const hero = game?.players[heroIndex];
  const bestHand = hero && visibleBoard.length >= 3
    ? handNames[evaluateHand([...hero.cards, ...visibleBoard]).category]
    : "Waiting for the flop";
  const outs = hero && visibleBoard.length >= 3 && visibleBoard.length < 5
    ? estimateOuts(hero.cards, visibleBoard)
    : 0;
  const heroContribution = game?.streetContributions[heroId] ?? 0;
  const callAmount = Math.max(0, (game?.currentBet ?? 0) - heroContribution);
  const raiseAmount = callAmount + Math.max(20, Math.round(((game?.pot ?? 15) * 0.6) / 10) * 10);

  function finishHand(
    current: GameState,
    result: HistoryEntry["result"],
    payout: number,
    label: string,
    winnerPayouts: Array<{ playerId: string; amount: number }> = payout > 0
      ? [{ playerId: heroId, amount: payout }]
      : [],
  ) {
    const heroPayout = winnerPayouts.find((winner) => winner.playerId === heroId)?.amount ?? 0;
    const net = heroPayout - current.invested;
    const bankroll = current.bankroll + heroPayout;
    const payoutFlights = winnerPayouts
      .filter((winner) => winner.amount > 0)
      .map((winner) => ({
        winnerId: winner.playerId,
        amount: winner.amount,
        id: `${Date.now()}-${winner.playerId}-${Math.random().toString(16).slice(2, 7)}`,
      }));
    const finished: GameState = {
      ...current,
      bankroll,
      pot: 0,
      players: current.players.map((player) =>
        winnerPayouts.some((winner) => winner.playerId === player.id)
          ? {
              ...player,
              stack: player.stack + (winnerPayouts.find((winner) => winner.playerId === player.id)?.amount ?? 0),
            }
          : player.id === heroId ? { ...player, stack: bankroll } : player,
      ),
      finished: true,
      result: label,
      resultTone: result === "win" ? "win" : result === "loss" ? "loss" : "neutral",
      winnerIds: winnerPayouts.filter((winner) => winner.amount > 0).map((winner) => winner.playerId),
      actionLog: [...current.actionLog, label],
    };
    if (payoutFlights.length) setPayoutFlights((previous) => [...previous, ...payoutFlights]);
    setGame(finished);
    setHistory((previous) => [createHistoryEntry(current, result, net, label), ...previous]);
  }

  async function advanceStreet(current: GameState) {
    if (current.stage === "river") {
      const { winners, bestRank } = findWinners(current.players, current.board);
      const heroWinner = winners.some((player) => player.id === heroId);
      const payouts = splitPot(current.pot, winners.map((player) => player.id));
      const payout = payouts.find((winner) => winner.playerId === heroId)?.amount ?? 0;
      const handName = handNames[bestRank.category];
      const resultLabel = !heroWinner
        ? `${winners[0].name} wins · ${handName}`
        : winners.length > 1 ? `Split pot · ${handName}` : `You win · ${handName}`;
      finishHand(current, heroWinner ? winners.length > 1 ? "tie" : "win" : "loss", payout, resultLabel, payouts);
      return;
    }

    const stages = ["preflop", "flop", "turn", "river"] as const;
    const nextStage = stages[stages.indexOf(current.stage) + 1];
    const nextState: GameState = {
      ...current,
      stage: nextStage,
      actingPlayerId: "",
      currentBet: 0,
      streetContributions: Object.fromEntries(current.players.map((player) => [player.id, 0])),
      raisesThisStreet: 0,
      botQueue: [],
      players: current.players.map((player) => ({ ...player, lastAction: player.folded ? "FOLD" : undefined })),
      actionLog: [...current.actionLog, `${stageNames[nextStage]} dealt`],
    };
    setGame(nextState);

    const cardsToReveal = nextStage === "flop" ? 3 : 1;
    for (let index = 1; index <= cardsToReveal; index += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 300));
      const visibleBoardCount = current.visibleBoardCount + index;
      setGame((previous) => previous && previous.stage === nextStage
        ? { ...previous, visibleBoardCount }
        : previous);
    }
    setGame((previous) => previous && previous.stage === nextStage
      ? { ...previous, actingPlayerId: heroId }
      : previous);
  }

  async function runBots(initialState: GameState) {
    let current = initialState;
    const queue = botProfiles
      .map((bot) => bot.id)
      .filter((botId) => {
        const player = current.players.find((item) => item.id === botId);
        return player && !player.folded && player.stack > 0;
      });
    for (let index = 0; index < queue.length; index += 1) {
      const botId = queue[index];
      const bot = current.players.find((player) => player.id === botId);
      if (!bot || bot.folded || bot.stack === 0) continue;
      current = {
        ...current,
        actingPlayerId: botId,
        botQueue: queue.slice(index),
      };
      setGame(current);
      await new Promise((resolve) => window.setTimeout(resolve, 650));
      current = runBotTurn(current, botId);
      current = {
        ...current,
        actingPlayerId: "",
        botQueue: queue.slice(index + 1),
      };
      setGame(current);
      await new Promise((resolve) => window.setTimeout(resolve, 550));
    }

    const activeBots = current.players.filter((player) => player.id !== heroId && !player.folded);
    if (activeBots.length === 0) {
      finishHand({ ...current, actingPlayerId: heroId, botQueue: [] }, "win", current.pot, "Everyone folded", [
        { playerId: heroId, amount: current.pot },
      ]);
      return;
    }
    if ((current.streetContributions[heroId] ?? 0) < current.currentBet) {
      setGame({ ...current, actingPlayerId: heroId, botQueue: [] });
      return;
    }
    await advanceStreet(current);
  }

  function playAction(action: "fold" | "call" | "raise") {
    if (!game || game.finished || game.actingPlayerId !== heroId) return;
    const cost = action === "fold" ? 0 : action === "call" ? callAmount : raiseAmount;
    if (action !== "fold" && cost > game.bankroll) {
      setToast("You need more chips to make that play.");
      return;
    }

    const players = game.players.map((player) => ({ ...player }));
    const heroPlayer = players.find((player) => player.id === heroId)!;
    let pot = game.pot;
    let bankroll = game.bankroll;
    let invested = game.invested;
    let currentBet = game.currentBet;
    let raisesThisStreet = game.raisesThisStreet;
    const streetContributions = { ...game.streetContributions };
    const actionLog = [...game.actionLog];

    if (action === "fold") {
      heroPlayer.folded = true;
      heroPlayer.lastAction = "FOLD";
      actionLog.push("You folded");
      const foldedState = { ...game, players, actionLog, actingPlayerId: "", botQueue: [] };
      const { winners, bestRank } = findWinners(players, game.board);
      const payouts = splitPot(game.pot, winners.map((player) => player.id));
      const winnerLabel = winners.length > 1
        ? `Split pot · ${handNames[bestRank.category]}`
        : `${winners[0].name} wins · ${handNames[bestRank.category]}`;
      finishHand(foldedState, "loss", 0, winnerLabel, payouts);
      return;
    }

    const payment = Math.min(cost, heroPlayer.stack);
    heroPlayer.stack -= payment;
    streetContributions[heroId] = (streetContributions[heroId] ?? 0) + payment;
    pot += payment;
    bankroll -= payment;
    invested += payment;
    if (action === "raise") {
      currentBet = streetContributions[heroId];
      raisesThisStreet += 1;
      heroPlayer.lastAction = `RAISE ${formatChips(payment)}`;
      actionLog.push(`You raised to ${formatChips(currentBet)}`);
    } else {
      heroPlayer.lastAction = payment > 0 ? `CALL ${formatChips(payment)}` : "CHECK";
      actionLog.push(payment > 0 ? `You called ${formatChips(payment)}` : "You checked");
    }

    const nextState: GameState = {
      ...game,
      players,
      pot,
      bankroll,
      invested,
      currentBet,
      streetContributions,
      raisesThisStreet,
      actionLog,
      actingPlayerId: "",
      botQueue: botProfiles.map((bot) => bot.id),
    };
    setGame(nextState);
    void runBots(nextState);
  }

  function startNextHand() {
    if (!game) return;
    const botStacks = Object.fromEntries(
      game.players.filter((player) => player.id !== heroId).map((player) => [player.id, player.stack]),
    );
    if (game.bankroll < 10) {
      setGame(createHand(1000, botStacks));
      setToast("Fresh stack: $1,000. Keep learning.");
    } else {
      setGame(createHand(game.bankroll, botStacks));
      setToast("");
    }
  }

  return {
    game,
    winnerIds: game?.winnerIds ?? [],
    history,
    toast,
    clearToast: () => setToast(""),
    payoutFlights,
    removePayoutFlight: (flightId: string) => setPayoutFlights((previous) => previous.filter((flight) => flight.id !== flightId)),
    visibleBoard,
    equity,
    heroIndex,
    hero,
    bestHand,
    outs,
    callAmount,
    raiseAmount,
    playAction,
    startNextHand,
  };
}
