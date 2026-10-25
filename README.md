# Riverstone Poker Lab

A play-money Texas Hold'em practice app built with Next.js, TypeScript, Tailwind CSS, and daisyUI.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## What is included

- A four-seat practice table with three bot opponents, per-street betting, calls, folds, raises, and showdown hand rankings.
- Animated card deals, clear acting/up-next indicators, and visible player action badges; opponents' hole cards are revealed at showdown.
- Bot decisions based on Monte Carlo hand equity, pot odds, distinct risk profiles, and randomized value-bet / bluff frequencies.
- Live hand-equity estimates using randomized unseen opponent cards and board runouts.
- Pot-odds and outs calculations with contextual strategy prompts.
- A recent hand table, win rate, net-chip total, and bankroll trend chart.
- Browser-local hand history saved in `localStorage`.

This is a simplified training simulation using play money and illustrative bot strategies. It is not a real-money game or a complete casino betting engine. Odds are Monte Carlo estimates and are intended for learning, not as guaranteed outcomes.
