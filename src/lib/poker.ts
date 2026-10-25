export type Suit = "♠" | "♥" | "♦" | "♣";

export type Card = {
  rank: number;
  suit: Suit;
};

export type PokerPlayer = {
  id: string;
  name: string;
  style: string;
  cards: [Card, Card];
  folded: boolean;
  stack: number;
  lastAction?: string;
};

export type HandStage = "preflop" | "flop" | "turn" | "river";

const suits: Suit[] = ["♠", "♥", "♦", "♣"];
const rankNames: Record<number, string> = {
  11: "J",
  12: "Q",
  13: "K",
  14: "A",
};

export function makeDeck(): Card[] {
  return suits.flatMap((suit) =>
    Array.from({ length: 13 }, (_, index) => ({ rank: index + 2, suit })),
  );
}

export function shuffle<T>(items: T[]): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

export function cardLabel(card: Card): string {
  return `${rankNames[card.rank] ?? card.rank}${card.suit}`;
}

export function cardColor(card: Card): "red" | "black" {
  return card.suit === "♥" || card.suit === "♦" ? "red" : "black";
}

type HandRank = {
  category: number;
  kickers: number[];
};

function compareRanks(left: HandRank, right: HandRank): number {
  if (left.category !== right.category) return left.category - right.category;
  for (let index = 0; index < Math.max(left.kickers.length, right.kickers.length); index += 1) {
    const difference = (left.kickers[index] ?? 0) - (right.kickers[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

function evaluateFive(cards: Card[]): HandRank {
  const counts = new Map<number, number>();
  for (const card of cards) counts.set(card.rank, (counts.get(card.rank) ?? 0) + 1);
  const groups = [...counts.entries()].sort(
    ([rankA, countA], [rankB, countB]) => countB - countA || rankB - rankA,
  );
  const uniqueRanks = [...counts.keys()].sort((a, b) => b - a);
  if (uniqueRanks.includes(14)) uniqueRanks.push(1);

  let straightHigh = 0;
  for (let index = 0; index <= uniqueRanks.length - 5; index += 1) {
    if (uniqueRanks[index] - uniqueRanks[index + 4] === 4) {
      straightHigh = uniqueRanks[index];
      break;
    }
  }

  const flush = cards.every((card) => card.suit === cards[0].suit);
  if (flush && straightHigh) return { category: 8, kickers: [straightHigh] };
  if (groups[0][1] === 4) {
    return { category: 7, kickers: [groups[0][0], groups[1][0]] };
  }
  if (groups[0][1] === 3 && groups[1][1] === 2) {
    return { category: 6, kickers: [groups[0][0], groups[1][0]] };
  }
  if (flush) return { category: 5, kickers: uniqueRanks.slice(0, 5) };
  if (straightHigh) return { category: 4, kickers: [straightHigh] };
  if (groups[0][1] === 3) {
    return { category: 3, kickers: [groups[0][0], ...groups.slice(1).map(([rank]) => rank)] };
  }
  if (groups[0][1] === 2 && groups[1][1] === 2) {
    return {
      category: 2,
      kickers: [groups[0][0], groups[1][0], groups[2][0]],
    };
  }
  if (groups[0][1] === 2) {
    return { category: 1, kickers: [groups[0][0], ...groups.slice(1).map(([rank]) => rank)] };
  }
  return { category: 0, kickers: uniqueRanks.slice(0, 5) };
}

export function evaluateHand(cards: Card[]): HandRank {
  let best: HandRank = { category: -1, kickers: [] };
  for (let a = 0; a < cards.length - 4; a += 1) {
    for (let b = a + 1; b < cards.length - 3; b += 1) {
      for (let c = b + 1; c < cards.length - 2; c += 1) {
        for (let d = c + 1; d < cards.length - 1; d += 1) {
          for (let e = d + 1; e < cards.length; e += 1) {
            const rank = evaluateFive([cards[a], cards[b], cards[c], cards[d], cards[e]]);
            if (compareRanks(rank, best) > 0) best = rank;
          }
        }
      }
    }
  }
  return best;
}

export const handNames = [
  "High card",
  "One pair",
  "Two pair",
  "Three of a kind",
  "Straight",
  "Flush",
  "Full house",
  "Four of a kind",
  "Straight flush",
];

export type EquityResult = {
  shares: number[];
  outrightWins: number[];
};

export function estimateEquity(
  players: PokerPlayer[],
  visibleBoard: Card[],
  iterations = 160,
  knownPlayerId = players[0]?.id,
): EquityResult {
  const activePlayers = players.filter((player) => !player.folded);
  const shares = Array(players.length).fill(0) as number[];
  const outrightWins = Array(players.length).fill(0) as number[];
  const knownPlayer = players.find((player) => player.id === knownPlayerId);
  if (activePlayers.length === 0 || !knownPlayer) return { shares, outrightWins };

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const unavailable = new Set(
      [...visibleBoard, ...knownPlayer.cards].map(
        (card) => `${card.rank}${card.suit}`,
      ),
    );
    const remaining = shuffle(
      makeDeck().filter((card) => !unavailable.has(`${card.rank}${card.suit}`)),
    );
    let cursor = 0;
    const simulatedCards = players.map((player) => {
      if (player.id === knownPlayerId) return player.cards;
      const cards: [Card, Card] = [remaining[cursor], remaining[cursor + 1]];
      cursor += 2;
      return cards;
    });
    const board = [...visibleBoard, ...remaining.slice(cursor, cursor + 5 - visibleBoard.length)];
    let best: HandRank | undefined;
    let winners: number[] = [];
    for (const player of activePlayers) {
      const rank = evaluateHand([...simulatedCards[players.indexOf(player)], ...board]);
      const comparison = best ? compareRanks(rank, best) : 1;
      if (comparison > 0) {
        best = rank;
        winners = [players.indexOf(player)];
      } else if (comparison === 0) {
        winners.push(players.indexOf(player));
      }
    }
    for (const winner of winners) shares[winner] += 1 / winners.length / iterations;
    if (winners.length === 1) outrightWins[winners[0]] += 1 / iterations;
  }
  return { shares, outrightWins };
}

export function estimateOuts(hero: Card[], board: Card[]): number {
  if (board.length >= 5) return 0;
  const currentRank = evaluateHand([...hero, ...board]);
  const known = new Set(
    [...hero, ...board]
      .map((card) => `${card.rank}${card.suit}`),
  );
  return makeDeck().filter((card) => {
    if (known.has(`${card.rank}${card.suit}`)) return false;
    return evaluateHand([...hero, ...board, card]).category > currentRank.category;
  }).length;
}

export function formatChips(value: number): string {
  return `$${Math.round(value).toLocaleString("en-US")}`;
}
