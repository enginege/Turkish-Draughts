import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface BoardProps {
  gameId: string;
  isPlayerTurn: boolean;
  onMove: (from: number[], to: number[]) => void;
}

export function Board({ gameId, isPlayerTurn, onMove }: BoardProps) {
  const [selectedPiece, setSelectedPiece] = useState<number[] | null>(null);
  const [board, setBoard] = useState<number[][]>(initializeBoard());

  function initializeBoard() {
    const board = Array(8).fill(null).map(() => Array(8).fill(0));
    // Set up black pieces (1)
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 8; j++) {
        board[i][j] = 1;
      }
    }
    // Set up white pieces (2)
    for (let i = 5; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        board[i][j] = 2;
      }
    }
    return board;
  }

  const handleSquareClick = (row: number, col: number) => {
    if (!isPlayerTurn) return;

    if (selectedPiece) {
      // Handle move
      const [selectedRow, selectedCol] = selectedPiece;
      if (isValidMove(selectedRow, selectedCol, row, col)) {
        onMove(selectedPiece, [row, col]);
        setSelectedPiece(null);
      } else {
        setSelectedPiece(null);
      }
    } else {
      // Select piece
      if (board[row][col] !== 0) {
        setSelectedPiece([row, col]);
      }
    }
  };

  const isValidMove = (fromRow: number, fromCol: number, toRow: number, toCol: number) => {
    // Implement Turkish Draughts move validation logic here
    return true; // Placeholder
  };

  return (
    <div className="bg-amber-100 p-4 rounded-lg shadow-lg">
      <div className="grid grid-cols-8 gap-1">
        {board.map((row, rowIndex) => (
          row.map((piece, colIndex) => (
            <button
              key={`${rowIndex}-${colIndex}`}
              onClick={() => handleSquareClick(rowIndex, colIndex)}
              className={cn(
                'w-16 h-16 flex items-center justify-center rounded-sm transition-colors',
                (rowIndex + colIndex) % 2 === 0 ? 'bg-amber-200' : 'bg-amber-300',
                selectedPiece?.[0] === rowIndex && selectedPiece?.[1] === colIndex && 'ring-2 ring-blue-500'
              )}
            >
              {piece !== 0 && (
                <div className={cn(
                  'w-12 h-12 rounded-full shadow-md transition-transform',
                  piece === 1 ? 'bg-gray-900' : 'bg-gray-100',
                  'hover:scale-105'
                )} />
              )}
            </button>
          ))
        ))}
      </div>
    </div>
  );
}