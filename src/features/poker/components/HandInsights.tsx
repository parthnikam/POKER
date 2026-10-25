import type { Card, EquityResult } from "@/lib/poker";
import { stageNames, type GameState } from "../model";

type HandInsightsProps = {
  game: GameState | null;
  visibleBoard: Card[];
  equity: EquityResult | null;
  heroIndex: number;
  bestHand: string;
  outs: number;
  callAmount: number;
};

function OddsBar({ value }: { value: number }) {
  return (
    <div className="odds-track">
      <div className="odds-fill green" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

export function HandInsights({ game, visibleBoard, equity, heroIndex, bestHand, outs, callAmount }: HandInsightsProps) {
  const equityPercent = Math.round((equity?.shares[heroIndex] ?? 0) * 100);
  const outrightPercent = Math.round((equity?.outrightWins[heroIndex] ?? 0) * 100);
  const potOdds = callAmount
    ? `${Math.round((callAmount / ((game?.pot ?? 15) + callAmount)) * 100)}%`
    : "—";

  return (
    <aside className="insight-strip" aria-label="Hand odds">
      <section className="metric-card equity-metric">
        <span className="metric-label">EQUITY</span>
        <strong>{equityPercent}<small>%</small></strong>
        <OddsBar value={equityPercent} />
        <span className="metric-detail">{outrightPercent}% outright</span>
      </section>
      <section className="metric-card">
        <span className="metric-label">POT ODDS</span>
        <strong>{potOdds}</strong>
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
  );
}
