"use client";

import { AnimatePresence, motion, useAnimationControls } from "framer-motion";
import { useLayoutEffect, useRef } from "react";
import { formatChips, type Card, type PokerPlayer } from "@/lib/poker";
import { botProfiles, heroId, stageNames, type GameState, type PayoutFlight } from "../model";
import { CardTile } from "./CardTile";

function PayoutFlightAnimation({
  flight,
  containerRef,
  targetRefs,
  onComplete,
}: {
  flight: PayoutFlight;
  containerRef: { current: HTMLDivElement | null };
  targetRefs: { current: Record<string, HTMLElement | null> };
  onComplete: (flightId: string) => void;
}) {
  const controls = useAnimationControls();
  const flightRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const target = targetRefs.current[flight.winnerId];
    const flightElement = flightRef.current;
    if (!container || !target || !flightElement) return;
    const containerRect = container.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const pot = container.querySelector(".pot-display")?.getBoundingClientRect();
    const origin = pot ?? containerRect;
    const flightWidth = flightElement.offsetWidth;
    const flightHeight = flightElement.offsetHeight;
    const start = {
      x: origin.left + origin.width / 2 - containerRect.left - flightWidth / 2,
      y: origin.top + origin.height / 2 - containerRect.top - flightHeight / 2,
    };
    const end = {
      x: targetRect.left + targetRect.width / 2 - containerRect.left - flightWidth / 2,
      y: targetRect.top + targetRect.height / 2 - containerRect.top - flightHeight / 2,
    };
    controls.set({ left: start.x, top: start.y, opacity: 0, scale: 0.65, y: 12 });
    void controls.start({
      left: end.x,
      top: end.y,
      opacity: [0, 1, 1, 0],
      scale: [0.65, 1.15, 1, 0.8],
      y: [12, -8, 0, 0],
      transition: { duration: 1.45, times: [0, 0.18, 0.78, 1], ease: [0.22, 0.72, 0.2, 1] },
    });
  }, [containerRef, controls, flight.winnerId, targetRefs]);

  const winnerName = flight.winnerId === heroId
    ? "you"
    : botProfiles.find((bot) => bot.id === flight.winnerId)?.name;

  return (
    <motion.div
      ref={flightRef}
      className="payout-flight"
      initial={{ opacity: 0, scale: 0.65, y: 12 }}
      animate={controls}
      onAnimationComplete={() => onComplete(flight.id)}
      aria-label={`${formatChips(flight.amount)} awarded to ${winnerName}`}
    >
      <span className="payout-coins"><i /><i /><i /></span>
      <strong>+{formatChips(flight.amount)}</strong>
    </motion.div>
  );
}

type PokerTableProps = {
  game: GameState | null;
  visibleBoard: Card[];
  hero?: PokerPlayer;
  handNumber: number;
  winnerIds: string[];
  payoutFlights: PayoutFlight[];
  onPayoutComplete: (flightId: string) => void;
};

export function PokerTable({
  game,
  visibleBoard,
  hero,
  handNumber,
  winnerIds,
  payoutFlights,
  onPayoutComplete,
}: PokerTableProps) {
  const heroTurn = Boolean(game && !game.finished && game.actingPlayerId === heroId);
  const winnerTargets = useRef<Record<string, HTMLElement | null>>({});
  const tableRef = useRef<HTMLDivElement>(null);

  return (
    <section className={`table-card ${game && !game.finished ? "turn-active" : ""}`} id="table">
      <div className="table-topline">
        <span className="table-overline">
          $5 / $10 BLINDS · PRACTICE · {stageNames[game?.stage ?? "preflop"].toUpperCase()}
        </span>
        <div className="round-counter"><span>HAND</span><strong>#{handNumber}</strong></div>
      </div>

      <div className="poker-felt">
        <div className="felt-grain" />
        <div className="table-rail" />
        <div className="table-oval" ref={tableRef}>
          <div className="oval-glow" />
          <div className="bot-row">
            {botProfiles.map((bot) => {
              const player = game?.players.find((item) => item.id === bot.id);
              const folded = player?.folded ?? false;
              const isActing = game?.actingPlayerId === bot.id;
              const isWinner = winnerIds.includes(bot.id);
              return (
                <div
                  className={`seat bot-seat ${bot.accent} ${bot.id === "bot-jack" ? "center-seat" : ""} ${folded && !isWinner ? "folded" : ""} ${isActing ? "seat-acting" : ""} ${isWinner ? "seat-winner" : ""}`}
                  key={bot.id}
                >
                  <div className="seat-avatar-row">
                    <div className="seat-avatar">{bot.avatar}</div>
                    {isWinner
                      ? <div className="winner-tag">WINNER</div>
                      : player?.lastAction && !isActing && <div className="bot-action">{player.lastAction}</div>}
                    {isActing && <div className="seat-turn-tag acting">THINKING</div>}
                  </div>
                  <div className="seat-name">{bot.name}</div>
                  <div className="seat-stack" ref={(element) => { winnerTargets.current[bot.id] = element; }}>
                    {folded && !isWinner ? "FOLDED" : formatChips(player?.stack ?? 1000)}
                  </div>
                  <div className="seat-cards">
                    <CardTile small card={game?.finished && !folded ? player?.cards[0] : undefined} faceDown={!game?.finished || folded} />
                    <CardTile small card={game?.finished && !folded ? player?.cards[1] : undefined} faceDown={!game?.finished || folded} />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pot-display" aria-label={`Pot ${formatChips(game?.pot ?? 15)}`}>
            <span className="pot-label">POT</span>
            <strong>{formatChips(game?.pot ?? 15)}</strong>
            <div className="pot-chips"><i /><i /><i /></div>
          </div>

          <div className="community-cards" aria-label="Community cards">
            {Array.from({ length: 5 }, (_, index) => (
              <CardTile key={index} card={visibleBoard[index]} faceDown={!visibleBoard[index]} />
            ))}
          </div>

          <AnimatePresence>
            {payoutFlights.map((flight) => (
              <PayoutFlightAnimation
                key={flight.id}
                flight={flight}
                containerRef={tableRef}
                targetRefs={winnerTargets}
                onComplete={onPayoutComplete}
              />
            ))}
          </AnimatePresence>

          <div className={`hero-seat ${heroTurn ? "is-your-turn" : ""}`}>
            <div className="hero-cards">
              <CardTile card={hero?.cards[0]} />
              <CardTile card={hero?.cards[1]} />
            </div>
            <div
              className={`hero-player ${heroTurn ? "turn-active" : ""} ${winnerIds.includes(heroId) ? "winner-active" : ""}`}
              ref={(element) => { winnerTargets.current[heroId] = element?.querySelector(".hero-player small") ?? null; }}
            >
              <div className="hero-avatar">Y</div>
              <div>
                <strong>You <span className="dealer-chip">D</span></strong>
                <small>{formatChips(game?.bankroll ?? 1000)} stack</small>
              </div>
              {(game?.finished || heroTurn) && (
                <span className="your-turn">{winnerIds.includes(heroId) ? "WINNER" : game?.finished ? "DONE" : "YOUR TURN"}</span>
              )}
            </div>
          </div>
        </div>
        <div className="table-decoration decor-left">✦</div>
        <div className="table-decoration decor-right">✦</div>
      </div>
    </section>
  );
}
