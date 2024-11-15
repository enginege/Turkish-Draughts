import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { onValue, ref } from "firebase/database";
import { db } from "@/lib/firebase";

interface BoardProps {
  gameId: string;
  isPlayerTurn: boolean;
  onMove: (from: number[], to: number[]) => void;
  playerColor: 'black' | 'white';
}

export function Board({ gameId, isPlayerTurn, onMove, playerColor }: BoardProps) {
  const [selectedPiece, setSelectedPiece] = useState<number[] | null>(null);
  const [board, setBoard] = useState<number[][]>([]);

  useEffect(() => {
    const gameRef = ref(db, `games/${gameId}`);
    const unsubscribe = onValue(gameRef, (snapshot) => {
      const data = snapshot.val();
      if (data?.board) {
        setBoard(data.board);
      }
    });

    return () => unsubscribe();
  }, [gameId]);

  const handleSquareClick = (rowIndex: number, colIndex: number) => {
    if (!isPlayerTurn) return;

    const piece = board[rowIndex][colIndex];
    // Only allow selecting own pieces
    if (!selectedPiece && piece !== 0) {
      const isBlackPiece = piece === 1;
      const isWhitePiece = piece === 2;

      // Debug logs to help identify the issue
      console.log('Player Color:', playerColor);
      console.log('Piece Selected:', piece);
      console.log('Is Black Piece:', isBlackPiece);
      console.log('Is White Piece:', isWhitePiece);

      if ((playerColor === 'black' && !isBlackPiece) ||
          (playerColor === 'white' && !isWhitePiece)) {
        return; // Can't select opponent's pieces
      }
      setSelectedPiece([rowIndex, colIndex]);
    } else if (selectedPiece) {
      // Check if the move is valid
      const playerColorNumber = playerColor === 'black' ? 1 : 2;
      if (isValidMove(selectedPiece[0], selectedPiece[1], rowIndex, colIndex, playerColorNumber)) {
        // Pass arrays for from and to positions
        onMove([selectedPiece[0], selectedPiece[1]], [rowIndex, colIndex]);
      }
      setSelectedPiece(null);
    }
  };

  const isValidMove = (fromRow: number, fromCol: number, toRow: number, toCol: number, playerColorNumber: number) => {
    if (board[toRow][toCol] !== 0) return false;

    // Basic movement rules
    const isForwardMove = playerColorNumber === 1 ? toRow > fromRow : toRow < fromRow;
    if (!isForwardMove) return false;

    // Check if it's a regular move (one square forward)
    const isRegularMove = Math.abs(toRow - fromRow) === 1 && Math.abs(toCol - fromCol) === 0;

    // Check if it's a capture move
    const isCaptureMove = Math.abs(toRow - fromRow) === 2 && Math.abs(toCol - fromCol) === 0;

    if (isCaptureMove) {
      // Check if there's an opponent's piece to capture
      const middleRow = (fromRow + toRow) / 2;
      const middlePiece = board[middleRow][fromCol];
      return middlePiece !== 0 && middlePiece !== playerColorNumber;
    }

    return isRegularMove;
  };

  return (
    <div className="bg-amber-100 p-4 rounded-lg shadow-lg">
      <div className="grid grid-cols-8 gap-1">
        {board.map((row, rowIndex) => (
          row.map((cell, colIndex) => (
            <div
              key={`${rowIndex}-${colIndex}`}
              className={cn(
                "w-16 h-16 border border-amber-900/20 flex items-center justify-center cursor-pointer",
                selectedPiece?.[0] === rowIndex && selectedPiece?.[1] === colIndex && "bg-yellow-200",
                isPlayerTurn && "hover:bg-amber-50"
              )}
              onClick={() => handleSquareClick(rowIndex, colIndex)}
            >
              {cell !== 0 && (
                <div className={cn(
                  "w-12 h-12 rounded-full",
                  cell === 1 ? "bg-black" : "bg-white border-2 border-gray-300",
                  "shadow-md"
                )} />
              )}
            </div>
          ))
        ))}
      </div>
    </div>
  );
}