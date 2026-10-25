"use client";

import { AnimatePresence, motion } from "framer-motion";
import { cardColor, cardLabel, type Card } from "@/lib/poker";

type CardTileProps = {
  card?: Card;
  faceDown?: boolean;
  small?: boolean;
};

export function CardTile({ card, faceDown = false, small = false }: CardTileProps) {
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
