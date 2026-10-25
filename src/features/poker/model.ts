import {
  cardLabel,
  evaluateHand,
  makeDeck,
  shuffle,
  type Card,
  type HandStage,
  type PokerPlayer,
} from "@/lib/poker";

export type HistoryEntry = {
  id: string;
  date: string;
  result: "win" | "loss" | "tie";
  net: number;
  hand: string;
  street: string;
  board?: string[];
  players?: Array<{
    id: string;
    name: string;
    cards: string[];
    folded: boolean;
  }>;
  actions?: string[];
};

type HistoricalPlayer = NonNullable<HistoryEntry["players"]>[number];

export type PayoutFlight = {
  id: string;
  winnerId: string;
  amount: number;
};

export type GameState = {
  stage: HandStage;
  board: Card[];
  visibleBoardCount: number;
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
  winnerIds?: string[];
  actionLog: string[];
};

export const botProfiles = [
  { id: "bot-mia", name: "Mia Chen", style: "Analyst", avatar: "MC", accent: "coral", betThreshold: 0.61, callMargin: 0.04, bluffRate: 0.06 },
  { id: "bot-jack", name: "Jack Rivers", style: "Shark", avatar: "JR", accent: "blue", betThreshold: 0.47, callMargin: 0.12, bluffRate: 0.28 },
  { id: "bot-ava", name: "Ava Stone", style: "Rock", avatar: "AS", accent: "violet", betThreshold: 0.69, callMargin: -0.02, bluffRate: 0.025 },
] as const;

export const heroId = "hero";

export const stageNames: Record<HandStage, string> = {
  preflop: "Pre-flop",
  flop: "The flop",
  turn: "The turn",
  river: "The river",
};

export const historyStorageKey = "riverstone-poker-history";

export function createHand(bankroll: number, botStacks: Record<string, number> = {}): GameState {
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
      stack: botStacks[bot.id] ?? 1000,
    })),
  ];

  return {
    stage: "preflop",
    board: deck.slice(cursor, cursor + 5),
    visibleBoardCount: 0,
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

export function compareHandRanks(left: ReturnType<typeof evaluateHand>, right: ReturnType<typeof evaluateHand>): number {
  if (left.category !== right.category) return left.category - right.category;
  for (let index = 0; index < Math.max(left.kickers.length, right.kickers.length); index += 1) {
    const difference = (left.kickers[index] ?? 0) - (right.kickers[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

export function findWinners(players: PokerPlayer[], board: Card[]) {
  const activePlayers = players.filter((player) => !player.folded);
  const ranks = activePlayers.map((player) => evaluateHand([...player.cards, ...board]));
  let bestRank = ranks[0];
  let winners = [activePlayers[0]];

  for (let index = 1; index < activePlayers.length; index += 1) {
    const comparison = compareHandRanks(ranks[index], bestRank);
    if (comparison > 0) {
      bestRank = ranks[index];
      winners = [activePlayers[index]];
    } else if (comparison === 0) {
      winners.push(activePlayers[index]);
    }
  }

  return { winners, bestRank };
}

export function splitPot(pot: number, winnerIds: string[]) {
  const share = Math.floor(pot / winnerIds.length);
  const remainder = pot - share * winnerIds.length;
  return winnerIds.map((playerId, index) => ({
    playerId,
    amount: share + (index === 0 ? remainder : 0),
  }));
}

export function isHistoryEntry(value: unknown): value is HistoryEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Record<string, unknown>;
  return typeof entry.id === "string"
    && typeof entry.date === "string"
    && (entry.result === "win" || entry.result === "loss" || entry.result === "tie")
    && typeof entry.net === "number"
    && typeof entry.hand === "string"
    && typeof entry.street === "string"
    && (entry.board === undefined || (Array.isArray(entry.board) && entry.board.every((card) => typeof card === "string")))
    && (entry.actions === undefined || (Array.isArray(entry.actions) && entry.actions.every((action) => typeof action === "string")))
    && (entry.players === undefined || (Array.isArray(entry.players) && entry.players.every(isHistoricalPlayer)));
}

function isHistoricalPlayer(value: unknown): value is HistoricalPlayer {
  if (!value || typeof value !== "object") return false;
  const player = value as Record<string, unknown>;
  return typeof player.id === "string"
    && typeof player.name === "string"
    && Array.isArray(player.cards)
    && player.cards.every((card) => typeof card === "string")
    && typeof player.folded === "boolean";
}

export function createHistoryEntry(
  current: GameState,
  result: HistoryEntry["result"],
  net: number,
  outcome: string,
): HistoryEntry {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 7)}`,
    date: new Date().toISOString(),
    result,
    net,
    hand: current.players[0].cards.map(cardLabel).join(" "),
    street: stageNames[current.stage],
    board: current.board.map(cardLabel),
    players: current.players.map((player) => ({
      id: player.id,
      name: player.name,
      cards: player.cards.map(cardLabel),
      folded: player.folded,
    })),
    actions: [...current.actionLog, outcome],
  };
}
