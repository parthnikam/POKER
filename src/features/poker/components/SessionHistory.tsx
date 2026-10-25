"use client";

import { Fragment, useState } from "react";
import { formatChips } from "@/lib/poker";
import type { HistoryEntry } from "../model";

const HANDS_PER_PAGE = 8;

function formatDate(date: string): string {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(date));
}

function ChipTrend({ history }: { history: HistoryEntry[] }) {
  const cumulative = [...history].reverse().reduce<number[]>((values, entry) => {
    values.push((values.at(-1) ?? 0) + entry.net);
    return values;
  }, [0]);
  const points = cumulative.length > 1 ? cumulative : [0, 0];
  const minimum = Math.min(0, ...points);
  const maximum = Math.max(0, ...points);
  const range = Math.max(100, maximum - minimum);
  const coordinates = points.map((value, index) => ({
    x: 8 + (index / Math.max(1, points.length - 1)) * 284,
    y: 86 - ((value - minimum) / range) * 72,
  }));
  const linePoints = coordinates.map(({ x, y }) => `${x},${y}`).join(" ");

  return (
    <div className="chart-card">
      <div className="chart-title"><h3>Chip trend</h3></div>
      {history.length ? (
        <div className="chart-wrap">
          <div className="chart-y-labels">
            <span>{formatChips(maximum)}</span>
            <span>{formatChips((maximum + minimum) / 2)}</span>
            <span>{formatChips(minimum)}</span>
          </div>
          <svg className="trend-chart" viewBox="0 0 300 100" preserveAspectRatio="none" role="img" aria-label="Cumulative chip results over time">
            <defs>
              <linearGradient id="chart-fill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#6d9d7b" stopOpacity=".2" />
                <stop offset="100%" stopColor="#6d9d7b" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={`M ${linePoints.replaceAll(" ", " L ")} L 292,98 L 8,98 Z`} fill="url(#chart-fill)" />
            <polyline points={linePoints} fill="none" stroke="#84b391" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
            {coordinates.map(({ x, y }, index) => <circle key={index} cx={x} cy={y} r="2.5" fill="#d0e6d5" />)}
          </svg>
          <div className="chart-x-labels"><span>{formatDate(history.at(-1)!.date)}</span><span>{formatDate(history[0].date)}</span></div>
        </div>
      ) : (
        <div className="empty-chart"><div className="empty-chart-line" /></div>
      )}
    </div>
  );
}

export function SessionHistory({ history }: { history: HistoryEntry[] }) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(history.length / HANDS_PER_PAGE));
  const currentPage = Math.min(page, pageCount);
  const pageEntries = history.slice((currentPage - 1) * HANDS_PER_PAGE, currentPage * HANDS_PER_PAGE);
  const wins = history.filter((entry) => entry.result === "win").length;
  const totalNet = history.reduce((sum, entry) => sum + entry.net, 0);
  const winRate = history.length ? Math.round((wins / history.length) * 100) : 0;

  return (
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
        <ChipTrend history={history} />
      </div>

      <div className="history-card">
        <div className="history-header"><h3>Recent hands</h3></div>
        {history.length ? (
          <div className="history-table-wrap">
            <table className="history-table">
              <thead><tr><th>DATE</th><th>HOLE CARDS</th><th>LAST STREET</th><th>OUTCOME</th><th>NET</th></tr></thead>
              <tbody>{pageEntries.map((entry) => (
                <Fragment key={entry.id}>
                  <tr key={`${entry.id}-summary`}>
                    <td>{formatDate(entry.date)}</td>
                    <td className="history-hand">{entry.hand}</td>
                    <td>{entry.street}</td>
                    <td><span className={`result-badge ${entry.result}`}>{entry.result}</span></td>
                    <td className={entry.net < 0 ? "negative" : "positive"}>{entry.net > 0 ? "+" : ""}{formatChips(entry.net)}</td>
                  </tr>
                  <tr className="history-detail-row" key={`${entry.id}-details`}>
                    <td colSpan={5}>
                      <details>
                        <summary>View hand details · {entry.actions?.length ?? 0} actions</summary>
                        {entry.players && (
                          <div className="history-hole-cards">
                            {entry.players.map((player) => (
                              <span key={player.id}>
                                <strong>{player.name}</strong> {player.cards.join(" ")}{player.folded ? " · folded" : ""}
                              </span>
                            ))}
                          </div>
                        )}
                        {entry.board && <p className="history-board">Board: {entry.board.join(" ")}</p>}
                        {entry.actions?.length ? (
                          <ol className="history-actions">
                            {entry.actions.map((action, index) => <li key={`${entry.id}-action-${index}`}>{action}</li>)}
                          </ol>
                        ) : (
                          <p className="history-legacy-note">Action details aren’t available for this older hand.</p>
                        )}
                      </details>
                    </td>
                  </tr>
                </Fragment>
              ))}</tbody>
            </table>
            {pageCount > 1 && (
              <nav className="history-pagination" aria-label="Recent hand pages">
                <button disabled={currentPage === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
                  Previous
                </button>
                <span>Page {currentPage} of {pageCount}</span>
                <button disabled={currentPage === pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))}>
                  Next
                </button>
              </nav>
            )}
          </div>
        ) : (
          <div className="empty-history">Play a hand to start your history.</div>
        )}
      </div>
    </section>
  );
}
