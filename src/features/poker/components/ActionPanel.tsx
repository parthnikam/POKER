import { formatChips } from "@/lib/poker";
import { botProfiles, heroId, type GameState } from "../model";

type ActionPanelProps = {
  game: GameState | null;
  callAmount: number;
  raiseAmount: number;
  onAction: (action: "fold" | "call" | "raise") => void;
  onNextHand: () => void;
};

function RefreshIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 7v5h-5M4 17v-5h5" />
      <path d="M6.1 9A7 7 0 0 1 18 6.5L20 12M4 12l2 5.5A7 7 0 0 0 18 15" />
    </svg>
  );
}

export function ActionPanel({ game, callAmount, raiseAmount, onAction, onNextHand }: ActionPanelProps) {
  const isHeroTurn = game?.actingPlayerId === heroId;
  const stage = !game
    ? "DEALING"
    : game.finished
      ? "SHOWDOWN"
      : isHeroTurn ? "YOUR TURN" : "TABLE ACTION";
  const message = !game
    ? "Dealing cards"
    : game.finished
      ? game.result ?? "Hand complete"
      : !isHeroTurn
        ? game.actingPlayerId
          ? `${botProfiles.find((bot) => bot.id === game.actingPlayerId)?.name ?? "Opponent"} is thinking`
          : "Bots are responding"
        : callAmount > 0 ? `It’s ${formatChips(callAmount)} to call` : "Your action";

  return (
    <div className="table-controls">
      <div className="action-copy">
        <span className={`action-stage ${game?.finished ? "hand-over" : !isHeroTurn ? "bot-thinking" : ""}`}>{stage}</span>
        <strong>{message}</strong>
      </div>
      {game?.finished ? (
        <button className="btn btn-primary action-button next-button" onClick={onNextHand}>
          <RefreshIcon /> Next hand
        </button>
      ) : !game ? null : isHeroTurn ? (
        <div className="action-buttons">
          <button className="btn action-button fold-button" onClick={() => onAction("fold")}>Fold</button>
          <button className="btn action-button call-button" onClick={() => onAction("call")}>
            {callAmount > 0 ? `Call ${formatChips(callAmount)}` : "Check"}
          </button>
          <button className="btn action-button raise-button" onClick={() => onAction("raise")}>
            {callAmount > 0 ? "Raise" : "Bet"} to {formatChips(raiseAmount + (game.streetContributions[heroId] ?? 0))}
          </button>
        </div>
      ) : (
        <div className="bot-turn-indicator" aria-live="polite">
          <span className="thinking-dots"><i /><i /><i /></span>
          <span>BOTS ARE PLAYING</span>
        </div>
      )}
    </div>
  );
}
