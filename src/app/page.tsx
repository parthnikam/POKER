"use client";

import { formatChips } from "@/lib/poker";
import { ActionPanel } from "@/features/poker/components/ActionPanel";
import { HandInsights } from "@/features/poker/components/HandInsights";
import { PokerTable } from "@/features/poker/components/PokerTable";
import { SessionHistory } from "@/features/poker/components/SessionHistory";
import { usePokerGame } from "@/features/poker/usePokerGame";

export default function Home() {
  const poker = usePokerGame();

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
              <strong>{formatChips(poker.game?.bankroll ?? 1000)}</strong>
              <small><span className="stack-dot" /> NO REAL MONEY</small>
            </div>
          </section>

          <div className="dashboard-grid">
            <PokerTable
              game={poker.game}
              visibleBoard={poker.visibleBoard}
              hero={poker.hero}
              handNumber={poker.history.length + 1}
              winnerIds={poker.winnerIds}
              payoutFlights={poker.payoutFlights}
              onPayoutComplete={poker.removePayoutFlight}
            />
            <ActionPanel
              game={poker.game}
              callAmount={poker.callAmount}
              raiseAmount={poker.raiseAmount}
              onAction={poker.playAction}
              onNextHand={poker.startNextHand}
            />
            <HandInsights
              game={poker.game}
              visibleBoard={poker.visibleBoard}
              equity={poker.equity}
              heroIndex={poker.heroIndex}
              bestHand={poker.bestHand}
              outs={poker.outs}
              callAmount={poker.callAmount}
            />
          </div>

          <SessionHistory history={poker.history} />
        </div>
      </section>

      {poker.toast && (
        <div className="toast-message" role="status">
          {poker.toast}
          <button onClick={poker.clearToast} aria-label="Dismiss">×</button>
        </div>
      )}
    </main>
  );
}
