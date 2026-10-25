"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import {
  cardColor,
  cardLabel,
  estimateEquity,
  estimateOuts,
  evaluateHand,
  formatChips,
  handNames,
  makeDeck,
  shuffle,
  type Card,
  type HandStage,
  type PokerPlayer,
} from "@/lib/poker";

type HistoryEntry = {
  id: string;
  date: string;
  result: "win" | "loss" | "tie";
  net: number;
  hand: string;
  street: string;
};

type PayoutFlight = {
  id: string;
  winnerId: string;
  amount: number;
};

type GameState = {
  stage: HandStage;
  board: Card[];
  players: PokerPlayer[];
  pot: number;
  bankroll: number;
  invested: number;
  currentBet: number;
  streetContributions: Record<string, number>;
  raisesThisStreet: number;
  actingPlayerId: string;
  botQueue: string[];
  finished: boolean;
  result?: string;
  resultTone?: "win" | "loss" | "neutral";
  actionLog: string[];
};

const botProfiles = [
  { id: "bot-mia", name: "Mia Chen", style: "Analyst", avatar: "MC", accent: "coral", betThreshold: 0.61, callMargin: 0.04, bluffRate: 0.06 },
  { id: "bot-jack", name: "Jack Rivers", style: "Shark", avatar: "JR", accent: "blue", betThreshold: 0.47, callMargin: 0.12, bluffRate: 0.28 },
  { id: "bot-ava", name: "Ava Stone", style: "Rock", avatar: "AS", accent: "violet", betThreshold: 0.69, callMargin: -0.02, bluffRate: 0.025 },
];
const heroId = "hero";
const stageNames: Record<HandStage, string> = {
  preflop: "Pre-flop",
  flop: "The flop",
  turn: "The turn",
  river: "The river",
};
const historyStorageKey = "riverstone-poker-history";

function createHand(bankroll: number): GameState {
  const deck = shuffle(makeDeck());
  let cursor = 0;
  const players: PokerPlayer[] = [
    {
      id: heroId,
      name: "You",
      style: "Learning at the tables",
      cards: [deck[cursor++], deck[cursor++]],
      folded: false,
      stack: bankroll,
    },
    ...botProfiles.map((bot) => ({
      id: bot.id,
      name: bot.name,
      style: bot.style,
      cards: [deck[cursor++], deck[cursor++]] as [Card, Card],
      folded: false,
      stack: 1000,
    })),
  ];
  return {
    stage: "preflop",
    board: deck.slice(cursor, cursor + 5),
    players,
    pot: 15,
    bankroll,
    invested: 0,
    currentBet: 10,
    streetContributions: Object.fromEntries(players.map((player) => [player.id, 0])),
    raisesThisStreet: 0,
    actingPlayerId: heroId,
    botQueue: [],
    finished: false,
    actionLog: ["Small blind $5 · Big blind $10"],
  };
}

function CardTile({ card, faceDown = false, small = false }: { card?: Card; faceDown?: boolean; small?: boolean }) {
  const concealed = !card || faceDown;
  const key = concealed ? "card-back" : cardLabel(card);
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={key}
        initial={{ opacity: 0, y: -18, rotate: -6, scale: 0.94 }}
        animate={{ opacity: 1, y: 0, rotate: 0, scale: 1 }}
        exit={{ opacity: 0, y: 9, rotate: 5, scale: 0.96 }}
        transition={{ type: "spring", stiffness: 360, damping: 25, mass: 0.65 }}
        className={`playing-card ${concealed ? "card-back" : cardColor(card!)} ${small ? "card-small" : ""}`}
        aria-label={concealed ? "Face-down card" : cardLabel(card!)}
      >
        {concealed ? (
          <span>✦</span>
        ) : (
          <>
            <span>{cardLabel(card!)}</span>
            <span className="card-center-suit">{card!.suit}</span>
          </>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

function Icon({ name, size = 18 }: { name: "cards" | "chart" | "bulb" | "clock" | "sparkle" | "refresh"; size?: number }) {
  const shared = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };
  const paths = {
    cards: <><rect x="3" y="5" width="13" height="16" rx="2" /><path d="m7 3 12 2a2 2 0 0 1 1.7 2.3l-1.1 7.1M7 9h5M7 13h5" /></>,
    chart: <><path d="M4 19V5M4 19h17" /><path d="m7 15 4-4 3 2 6-7" /></>,
    bulb: <><path d="M9 18h6M10 22h4M8.2 14.5a7 7 0 1 1 7.6 0c-.9.6-1.3 1.5-1.3 2.5h-5c0-1-.4-1.9-1.3-2.5Z" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    sparkle: <><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" /><path d="m19 15 .9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15Z" /></>,
    refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M6.1 9A7 7 0 0 1 18 6.5L20 12M4 12l2 5.5A7 7 0 0 0 18 15" /></>,
  };
  return <svg {...shared}>{paths[name]}</svg>;
}

function getEquityPercent(value: number): number {
  return Math.round(value * 100);
}

function OddsBar({ value, color = "green" }: { value: number; color?: "green" | "gold" }) {
  return (
    <div className="odds-track">
      <div className={`odds-fill ${color}`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(date));
}

function isHistoryEntry(value: unknown): value is HistoryEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Record<string, unknown>;
  return typeof entry.id === "string"
    && typeof entry.date === "string"
    && (entry.result === "win" || entry.result === "loss" || entry.result === "tie")
    && typeof entry.net === "number"
    && typeof entry.hand === "string"
    && typeof entry.street === "string";
}

export default function Home() {
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
          setHistory(parsed.filter(isHistoryEntry).slice(0, 100));
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

  const visibleCount = game
    ? game.stage === "preflop" ? 0 : game.stage === "flop" ? 3 : game.stage === "turn" ? 4 : 5
    : 0;
  const visibleBoard = useMemo(() => game?.board.slice(0, visibleCount) ?? [], [game, visibleCount]);
  const equity = useMemo(
    () => (game ? estimateEquity(game.players, visibleBoard, game.stage === "preflop" ? 180 : 200) : null),
    [game, visibleBoard],
  );
  const heroIndex = game?.players.findIndex((player) => player.id === heroId) ?? 0;
  const heroEquity = equity?.shares[heroIndex] ?? 0;
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
  const wins = history.filter((entry) => entry.result === "win").length;
  const totalNet = history.reduce((sum, entry) => sum + entry.net, 0);
  const winRate = history.length ? Math.round((wins / history.length) * 100) : 0;
  const cumulative = [...history].reverse().reduce<number[]>((values, entry) => {
    values.push((values.at(-1) ?? 0) + entry.net);
    return values;
  }, [0]);
  const chartPoints = cumulative.length > 1 ? cumulative : [0, 0];
  const chartMin = Math.min(0, ...chartPoints);
  const chartMax = Math.max(0, ...chartPoints);
  const chartRange = Math.max(100, chartMax - chartMin);
  const linePoints = chartPoints
    .map((value, index) => {
      const x = 8 + (index / Math.max(1, chartPoints.length - 1)) * 284;
      const y = 86 - ((value - chartMin) / chartRange) * 72;
      return `${x},${y}`;
    })
    .join(" ");

  function finishHand(
    current: GameState,
    result: "win" | "loss" | "tie",
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
        ...winner,
        id: `${Date.now()}-${winner.playerId}-${Math.random().toString(16).slice(2, 7)}`,
      }));
    const finished: GameState = {
      ...current,
      bankroll,
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
      actionLog: [...current.actionLog, label],
    };
    if (payoutFlights.length) setPayoutFlights((previous) => [...previous, ...payoutFlights]);
    setGame(finished);
    setHistory((previous) => [{
      id: `${Date.now()}-${Math.random().toString(16).slice(2, 7)}`,
      date: new Date().toISOString(),
      result,
      net,
      hand: current.players[0].cards.map(cardLabel).join(" "),
      street: stageNames[current.stage],
    }, ...previous].slice(0, 100));
  }

  function runBotTurn(current: GameState, botId: string): GameState {
    const players = current.players.map((player) => ({ ...player }));
    const bot = players.find((player) => player.id === botId);
    if (!bot || bot.folded) return current;
    const stageBoardCount = current.stage === "preflop" ? 0 : current.stage === "flop" ? 3 : current.stage === "turn" ? 4 : 5;
    const board = current.board.slice(0, stageBoardCount);
    const profile = botProfiles.find((item) => item.id === botId)!;
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

  function advanceStreet(current: GameState) {
    if (current.stage === "river") {
      const activePlayers = current.players.filter((player) => !player.folded);
      const ranks = activePlayers.map((player) => evaluateHand([...player.cards, ...current.board]));
      let bestRank = ranks[0];
      let winners = [activePlayers[0]];
      for (let index = 1; index < activePlayers.length; index += 1) {
        const left = ranks[index];
        let comparison = left.category - bestRank.category;
        if (!comparison) {
          for (let kicker = 0; kicker < Math.max(left.kickers.length, bestRank.kickers.length); kicker += 1) {
            comparison = (left.kickers[kicker] ?? 0) - (bestRank.kickers[kicker] ?? 0);
            if (comparison) break;
          }
        }
        if (comparison > 0) {
          bestRank = left;
          winners = [activePlayers[index]];
        } else if (comparison === 0) {
          winners.push(activePlayers[index]);
        }
      }
      const heroWinner = winners.some((player) => player.id === heroId);
      const share = Math.floor(current.pot / winners.length);
      const remainder = current.pot - share * winners.length;
      const payouts = winners.map((player, index) => ({
        playerId: player.id,
        amount: share + (index === 0 ? remainder : 0),
      }));
      const payout = payouts.find((winner) => winner.playerId === heroId)?.amount ?? 0;
      const handName = handNames[bestRank.category];
      const resultLabel = !heroWinner
        ? `${winners[0].name} wins · ${handName}`
        : winners.length > 1 ? `Split pot · ${handName}` : `You win · ${handName}`;
      finishHand(current, heroWinner ? winners.length > 1 ? "tie" : "win" : "loss", payout, resultLabel, payouts);
      return;
    }

    const stages: HandStage[] = ["preflop", "flop", "turn", "river"];
    const nextStage = stages[stages.indexOf(current.stage) + 1];
    setGame({
      ...current,
      stage: nextStage,
      currentBet: 0,
      streetContributions: Object.fromEntries(current.players.map((player) => [player.id, 0])),
      raisesThisStreet: 0,
      actingPlayerId: heroId,
      botQueue: [],
      players: current.players.map((player) => ({ ...player, lastAction: player.folded ? "FOLD" : undefined })),
      actionLog: [...current.actionLog, `${stageNames[nextStage]} dealt`],
    });
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
    advanceStreet(current);
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
      const remaining = players.filter((player) => !player.folded);
      if (remaining.length === 1 && remaining[0].id !== heroId) {
        finishHand(foldedState, "loss", 0, `${remaining[0].name} wins`, [
          { playerId: remaining[0].id, amount: game.pot },
        ]);
      } else {
        finishHand(foldedState, "loss", 0, "You folded");
      }
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
    if (game.bankroll < 10) {
      setGame(createHand(1000));
      setToast("Fresh stack: $1,000. Keep learning.");
    } else {
      setGame(createHand(game.bankroll));
      setToast("");
    }
  }

  return (
    <main className="app-shell">
      <section className="main-content">
        <header className="topbar">
          <a className="wordmark" href="#" aria-label="Riverstone Poker">RIVERSTONE<span>POKER</span></a>
          <div className="topbar-right">
            <a className="history-link" href="#progress">History <span>↗</span></a>
            <span className="mode-pill"><span /> PLAY MONEY</span>
          </div>
        </header>

        <div className="page-content">
          <section className="page-heading">
            <h1>Texas Hold&apos;em</h1>
            <div className="session-stack">
              <span>STACK</span>
              <strong>{formatChips(game?.bankroll ?? 1000)}</strong>
              <small><span className="stack-dot" /> NO REAL MONEY</small>
            </div>
          </section>

          <div className="dashboard-grid">
            <section className={`table-card ${game && !game.finished ? "turn-active" : ""}`} id="table">
              <div className="table-topline">
                <div>
                  <span className="table-overline">$5 / $10 BLINDS</span>
                  <h2>Practice table <span className="table-live">LIVE</span></h2>
                </div>
                <div className="round-counter"><span>HAND</span><strong>#{history.length + 1}</strong></div>
              </div>

              <div className="poker-felt">
                <div className="felt-grain" />
                <div className="table-rail" />
                <div className="table-oval">
                  <div className="oval-glow" />
                  <div className="bot-row">
                    {botProfiles.map((bot) => {
                      const player = game?.players.find((item) => item.id === bot.id);
                      const folded = player?.folded ?? false;
                      const isActing = game?.actingPlayerId === bot.id;
                      const queueIndex = game?.botQueue.indexOf(bot.id) ?? -1;
                      const upcomingIndex = game?.actingPlayerId ? 1 : 0;
                      const isNext = !isActing && !folded && queueIndex === upcomingIndex;
                      const isWaiting = !isActing && !isNext && !folded && queueIndex > upcomingIndex;
                      return (
                        <div className={`seat bot-seat ${bot.accent} ${bot.id === "bot-jack" ? "center-seat" : ""} ${folded ? "folded" : ""} ${isActing ? "seat-acting" : ""}`} key={bot.id}>
                          <div className="seat-avatar">{bot.avatar}</div>
                          <div className="seat-name">{bot.name}</div>
                          <div className="seat-stack">{folded ? "FOLDED" : formatChips(player?.stack ?? 1000)}</div>
                          {player?.lastAction && !isActing && !isNext && <div className="bot-action">{player.lastAction}</div>}
                          {(isActing || isNext || isWaiting) && <div className={`seat-turn-tag ${isActing ? "acting" : ""}`}>{isActing ? "THINKING" : isNext ? "UP NEXT" : "WAITING"}</div>}
                          <div className="seat-cards">
                            <CardTile small card={game?.finished && !folded ? player?.cards[0] : undefined} faceDown={!game?.finished || folded} />
                            <CardTile small card={game?.finished && !folded ? player?.cards[1] : undefined} faceDown={!game?.finished || folded} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="pot-display">
                    <span className="pot-label">POT</span>
                    <strong>{formatChips(game?.pot ?? 15)}</strong>
                    <div className="pot-chips"><i /><i /><i /></div>
                  </div>
                  <div className="community-cards" aria-label="Community cards">
                    {Array.from({ length: 5 }, (_, index) => (
                      <CardTile key={index} card={visibleBoard[index]} faceDown={!visibleBoard[index]} />
                    ))}
                  </div>
                  <div className="street-label">{game ? stageNames[game.stage].toUpperCase() : "GETTING TABLE READY"}</div>
                  <div className={`hero-seat ${game && !game.finished && game.actingPlayerId === heroId ? "is-your-turn" : ""}`}>
                    <div className="hero-cards">
                      <CardTile card={hero?.cards[0]} />
                      <CardTile card={hero?.cards[1]} />
                    </div>
                    <div className={`hero-player ${game && !game.finished && game.actingPlayerId === heroId ? "turn-active" : ""}`}>
                      <div className="hero-avatar">Y</div>
                      <div><strong>You <span className="dealer-chip">D</span></strong><small>{formatChips(game?.bankroll ?? 1000)} stack</small></div>
                      <span className="your-turn">{game?.finished ? "DONE" : game?.actingPlayerId === heroId ? "YOUR TURN" : "UP NEXT"}</span>
                    </div>
                  </div>
                </div>
                <div className="table-decoration decor-left">✦</div>
                <div className="table-decoration decor-right">✦</div>
              </div>

              <div className="table-controls">
                <div className="action-copy">
                  <span className={`action-stage ${game?.finished ? "hand-over" : game?.actingPlayerId !== heroId ? "bot-thinking" : ""}`}>{!game ? "DEALING" : game.finished ? "SHOWDOWN" : game.actingPlayerId === heroId ? "YOUR TURN" : "TABLE ACTION"}</span>
                  <strong>
                    {!game ? "Dealing cards" : game.finished ? (game.result ?? "Hand complete") : game.actingPlayerId !== heroId
                      ? game.actingPlayerId
                        ? `${botProfiles.find((bot) => bot.id === game.actingPlayerId)?.name ?? "Opponent"} is thinking`
                        : "Bots are responding"
                      : callAmount > 0 ? `It’s ${formatChips(callAmount)} to call` : "Your action"}
                  </strong>
                </div>
                {game?.finished ? (
                  <button className="btn btn-primary action-button next-button" onClick={startNextHand}>
                    <Icon name="refresh" size={16} /> Next hand
                  </button>
                ) : !game ? null : game.actingPlayerId === heroId ? (
                  <div className="action-buttons">
                    <button className="btn action-button fold-button" onClick={() => playAction("fold")}>Fold</button>
                    <button className="btn action-button call-button" onClick={() => playAction("call")}>
                      {callAmount > 0 ? `Call ${formatChips(callAmount)}` : "Check"}
                    </button>
                    <button className="btn action-button raise-button" onClick={() => playAction("raise")}>
                      {callAmount > 0 ? "Raise" : "Bet"} to {formatChips(raiseAmount + heroContribution)}
                    </button>
                  </div>
                ) : (
                  <div className="bot-turn-indicator" aria-live="polite">
                    <span className="thinking-dots"><i /><i /><i /></span>
                    <span>{game?.botQueue.length ?? 0} TO ACT</span>
                  </div>
                )}
              </div>
            </section>

            <aside className="insight-strip" aria-label="Hand odds">
              <section className="metric-card equity-metric">
                <span className="metric-label">EQUITY</span>
                <strong>{getEquityPercent(heroEquity)}<small>%</small></strong>
                <OddsBar value={getEquityPercent(heroEquity)} />
                <span className="metric-detail">{getEquityPercent(equity?.outrightWins[heroIndex] ?? 0)}% outright</span>
              </section>
              <section className="metric-card">
                <span className="metric-label">POT ODDS</span>
                <strong>{callAmount ? `${Math.round((callAmount / ((game?.pot ?? 15) + callAmount)) * 100)}%` : "—"}</strong>
                <span className="metric-detail">Call ÷ (pot + call)</span>
              </section>
              <section className="metric-card">
                <span className="metric-label">OUTS</span>
                <strong>{visibleBoard.length >= 3 && visibleBoard.length < 5 ? outs : "—"}</strong>
                <span className="metric-detail">Unseen cards to improve</span>
              </section>
              <section className="metric-card">
                <span className="metric-label">MADE HAND</span>
                <strong className="hand-metric">{visibleBoard.length >= 3 ? bestHand : "—"}</strong>
                <span className="metric-detail">{stageNames[game?.stage ?? "preflop"]}</span>
              </section>
            </aside>
          </div>

          <section className="progress-section" id="progress">
            <div className="section-title-row">
              <h2>Session history</h2>
              <span className="history-count">{history.length} HANDS</span>
            </div>
            <div className="progress-grid">
              <div className="stats-column">
                <div className="stat-card"><span>HANDS</span><strong>{history.length}</strong></div>
                <div className="stat-card"><span>WIN RATE</span><strong>{winRate}<small>%</small></strong></div>
                <div className="stat-card"><span>NET</span><strong className={totalNet < 0 ? "negative" : "positive"}>{totalNet > 0 ? "+" : ""}{formatChips(totalNet)}</strong></div>
              </div>
              <div className="chart-card">
                <div className="chart-title"><h3>Chip trend</h3></div>
                {history.length ? (
                  <div className="chart-wrap">
                    <div className="chart-y-labels"><span>{formatChips(chartMax)}</span><span>{formatChips((chartMax + chartMin) / 2)}</span><span>{formatChips(chartMin)}</span></div>
                    <svg className="trend-chart" viewBox="0 0 300 100" preserveAspectRatio="none" role="img" aria-label="Cumulative chip results over time">
                      <defs><linearGradient id="chart-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#6d9d7b" stopOpacity=".2" /><stop offset="100%" stopColor="#6d9d7b" stopOpacity="0" /></linearGradient></defs>
                      <path d={`M ${linePoints.replaceAll(" ", " L ")} L 292,98 L 8,98 Z`} fill="url(#chart-fill)" />
                      <polyline points={linePoints} fill="none" stroke="#84b391" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
                      {chartPoints.map((value, index) => <circle key={index} cx={8 + (index / Math.max(1, chartPoints.length - 1)) * 284} cy={86 - ((value - chartMin) / chartRange) * 72} r="2.5" fill="#d0e6d5" />)}
                    </svg>
                    <div className="chart-x-labels"><span>{formatDate(history.at(-1)!.date)}</span><span>{formatDate(history[0].date)}</span></div>
                  </div>
                ) : (
                  <div className="empty-chart"><div className="empty-chart-line" /></div>
                )}
              </div>
            </div>

            <div className="history-card">
              <div className="history-header"><h3>Recent hands</h3></div>
              {history.length ? (
                <div className="history-table-wrap">
                  <table className="history-table">
                    <thead><tr><th>DATE</th><th>HOLE CARDS</th><th>LAST STREET</th><th>OUTCOME</th><th>NET</th></tr></thead>
                    <tbody>{history.slice(0, 8).map((entry) => (
                      <tr key={entry.id}>
                        <td>{formatDate(entry.date)}</td>
                        <td className="history-hand">{entry.hand}</td>
                        <td>{entry.street}</td>
                        <td><span className={`result-badge ${entry.result}`}>{entry.result}</span></td>
                        <td className={entry.net < 0 ? "negative" : "positive"}>{entry.net > 0 ? "+" : ""}{formatChips(entry.net)}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-history">Play a hand to start your history.</div>
              )}
            </div>
          </section>

        </div>
      </section>

      {toast && <div className="toast-message" role="status">{toast}<button onClick={() => setToast("")} aria-label="Dismiss">×</button></div>}
    </main>
  );
}
