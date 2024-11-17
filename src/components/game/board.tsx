import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { onValue, ref } from "firebase/database";
import { db } from "@/lib/firebase";

interface BoardProps {
  gameId: string;
  isPlayerTurn: boolean;
  onMove: (from: number[], to: number[], partialSequence: { moves: number[][], captures: number[][], isComplete: boolean }) => void;
  playerColor: 'black' | 'white';
}

interface CaptureSequence {
  moves: number[][];
  captures: number[][];
}

interface CaptureNode {
  position: number[];
  board: number[][];
  sequence: CaptureSequence;
  direction?: number[];
}

export function Board({ gameId, isPlayerTurn, onMove, playerColor }: BoardProps) {
  const [selectedPiece, setSelectedPiece] = useState<number[] | null>(null);
  const [board, setBoard] = useState<number[][]>([]);
  const [kings, setKings] = useState<Set<string>>(new Set());
  const [validMoves, setValidMoves] = useState<number[][]>([]);
  const [sequencePath, setSequencePath] = useState<number[][]>([]);
  const [currentSequence, setCurrentSequence] = useState<CaptureSequence | null>(null);

  useEffect(() => {
    const gameRef = ref(db, `games/${gameId}`);
    const unsubscribe = onValue(gameRef, (snapshot) => {
      const data = snapshot.val();
      if (data?.board) {
        setBoard(data.board);
        setKings(new Set(data.kings || []));
      }
    });

    return () => unsubscribe();
  }, [gameId]);

  const isKing = (row: number, col: number) => {
    return kings.has(`${row},${col}`);
  };

  const getValidMoves = (fromRow: number, fromCol: number): number[][] => {
    const moves: number[][] = [];
    const piece = board[fromRow][fromCol];
    const isCurrentKing = kings.has(`${fromRow},${fromCol}`);
    const directions = [[0, 1], [1, 0], [0, -1], [-1, 0]];

    for (const [dx, dy] of directions) {
      // Skip backward movement for regular pieces
      if (!isCurrentKing && ((playerColor === 'black' && dx < 0) ||
          (playerColor === 'white' && dx > 0))) {
        continue;
      }

      let x = fromRow + dx;
      let y = fromCol + dy;

      while (x >= 0 && x < 8 && y >= 0 && y < 8) {
        if (board[x][y] !== 0) break;
        moves.push([x, y]);
        if (!isCurrentKing) break; // Regular pieces only move one square
        x += dx;
        y += dy;
      }
    }

    return moves;
  };

  const findKingCaptureSequences = (
    startRow: number,
    startCol: number,
    currentBoard: number[][],
    currentSequence: CaptureSequence = { moves: [], captures: [] },
    previousDirection?: number[]
  ): CaptureSequence[] => {
    const piece = currentBoard[startRow][startCol];
    const sequences: CaptureSequence[] = [];
    const queue: CaptureNode[] = [{
      position: [startRow, startCol],
      board: currentBoard,
      sequence: currentSequence,
      direction: previousDirection
    }];

    while (queue.length > 0) {
      const { position: [row, col], board, sequence, direction } = queue.shift()!;
      let foundCapture = false;

      // Log for debugging
      console.log('Current position:', row, col);
      console.log('Previous direction:', direction);

      const directions = [[0, 1], [1, 0], [0, -1], [-1, 0]];
      for (const [dx, dy] of directions) {
        // Skip opposite direction more explicitly
        if (direction) {
          const isOppositeDirection = (dx === -direction[0] && dy === -direction[1]);
          if (isOppositeDirection) {
            console.log('Skipping opposite direction:', dx, dy);
            continue;
          }
        }

        let x = row + dx;
        let y = col + dy;

        while (x >= 0 && x < 8 && y >= 0 && y < 8) {
          if (board[x][y] === 0) {
            x += dx;
            y += dy;
            continue;
          }

          if (board[x][y] === piece) break;
          if (sequence.captures.some(([cr, cc]) => cr === x && cc === y)) break;

          const enemyPos = [x, y];
          x += dx;
          y += dy;

          while (x >= 0 && x < 8 && y >= 0 && y < 8) {
            if (board[x][y] !== 0) break;

            foundCapture = true;
            const newBoard = board.map(row => [...row]);
            newBoard[enemyPos[0]][enemyPos[1]] = 0;
            newBoard[row][col] = 0;
            newBoard[x][y] = piece;

            const newSequence = {
              moves: [...sequence.moves, [x, y]],
              captures: [...sequence.captures, enemyPos]
            };

            // Store the current direction for the next iteration
            const currentDirection = [dx, dy];

            console.log('Adding new capture sequence:', {
              position: [x, y],
              direction: currentDirection,
              moves: newSequence.moves,
              captures: newSequence.captures
            });

            queue.push({
              position: [x, y],
              board: newBoard,
              sequence: newSequence,
              direction: currentDirection
            });

            x += dx;
            y += dy;
          }
          break;
        }
      }

      if (!foundCapture && sequence.captures.length > 0) {
        sequences.push(sequence);
      }
    }

    return sequences;
  };

  const findCaptureSequences = (
    row: number,
    col: number,
    sequence: CaptureSequence = { moves: [], captures: [] },
    currentBoard: number[][] = board
  ): CaptureSequence[] => {
    const isCurrentKing = kings.has(`${row},${col}`);

    if (isCurrentKing) {
      return findKingCaptureSequences(row, col, currentBoard, sequence);
    }

    // Regular piece capture logic remains the same
    const sequences: CaptureSequence[] = [];
    const piece = currentBoard[row][col];
    const directions = [[0, 1], [1, 0], [0, -1], [-1, 0]];

    for (const [dx, dy] of directions) {
      if ((playerColor === 'black' && dx < 0) || (playerColor === 'white' && dx > 0)) {
        continue;
      }

      let x = row + dx;
      let y = col + dy;

      while (x >= 0 && x < 8 && y >= 0 && y < 8) {
        if (currentBoard[x][y] === 0) break;
        if (currentBoard[x][y] === piece) break;
        if (sequence.captures.some(([cr, cc]) => cr === x && cc === y)) break;

        const enemyPos = [x, y];
        x += dx;
        y += dy;

        if (x >= 0 && x < 8 && y >= 0 && y < 8 && currentBoard[x][y] === 0) {
          const newBoard = currentBoard.map(row => [...row]);
          newBoard[enemyPos[0]][enemyPos[1]] = 0;
          newBoard[row][col] = 0;
          newBoard[x][y] = piece;

          const newSequence = {
            moves: [...sequence.moves, [x, y]],
            captures: [...sequence.captures, enemyPos]
          };

          const furtherSequences = findCaptureSequences(x, y, newSequence, newBoard);
          if (furtherSequences.length > 0) {
            sequences.push(...furtherSequences);
          } else {
            sequences.push(newSequence);
          }
        }
        break;
      }
    }

    return sequences;
  };

  const handleSquareClick = (rowIndex: number, colIndex: number) => {
    if (!isPlayerTurn) return;

    if (!selectedPiece) {
      const piece = board[rowIndex][colIndex];
      if ((playerColor === 'black' && piece === 1) || (playerColor === 'white' && piece === 2)) {
        // Find maximum possible captures on the board
        const maxPossibleCaptures = findMaximumCaptures();

        if (maxPossibleCaptures > 0) {
          // Only allow selecting pieces that can achieve the maximum captures
          const sequences = findCaptureSequences(rowIndex, colIndex);
          const maxForThisPiece = sequences.length > 0
            ? Math.max(...sequences.map(seq => seq.captures.length))
            : 0;

          if (maxForThisPiece < maxPossibleCaptures) {
            return; // Can't select pieces with fewer than maximum possible captures
          }

          setSelectedPiece([rowIndex, colIndex]);

          // Find the longest capture sequences for this piece
          const longestSequences = sequences.filter(seq =>
            seq.captures.length === maxForThisPiece
          );

          // Show all first moves from the longest sequences
          const firstMoves = longestSequences.map(seq => seq.moves[0]);
          // Remove duplicates if any
          const uniqueFirstMoves = firstMoves.filter((move, index, self) =>
            self.findIndex(m => m[0] === move[0] && m[1] === move[1]) === index
          );

          setCurrentSequence(longestSequences[0]); // Keep one sequence as reference
          setValidMoves(uniqueFirstMoves);
          // Show paths for all longest sequences
          const allPaths = longestSequences.flatMap(seq => seq.moves);
          setSequencePath(allPaths);
        } else {
          // No captures available, proceed with normal moves
          setSelectedPiece([rowIndex, colIndex]);
          setValidMoves(getValidMoves(rowIndex, colIndex));
          setSequencePath([]);
        }
      }
    } else {
      const isValidMove = validMoves.some(([row, col]) => row === rowIndex && col === colIndex);
      if (isValidMove && currentSequence) {
        // Find which sequence this move belongs to
        const sequences = findCaptureSequences(selectedPiece[0], selectedPiece[1]);
        const maxCaptures = Math.max(...sequences.map(seq => seq.captures.length));
        const longestSequences = sequences.filter(seq => seq.captures.length === maxCaptures);

        // Find the sequence that matches this move
        const matchingSequence = longestSequences.find(seq =>
          seq.moves.some(([row, col]) => row === rowIndex && col === colIndex)
        );

        if (matchingSequence) {
          const currentMoveIndex = matchingSequence.moves.findIndex(
            ([row, col]) => row === rowIndex && col === colIndex
          );

          const partialSequence = {
            moves: [matchingSequence.moves[currentMoveIndex]],
            captures: [matchingSequence.captures[currentMoveIndex]],
            isComplete: currentMoveIndex === matchingSequence.moves.length - 1
          };

          onMove(selectedPiece, [rowIndex, colIndex], partialSequence);

          if (!partialSequence.isComplete) {
            // Update the board state locally for next move calculation
            const newBoard = board.map(row => [...row]);
            const [captureRow, captureCol] = matchingSequence.captures[currentMoveIndex];
            newBoard[captureRow][captureCol] = 0; // Remove captured piece
            newBoard[selectedPiece[0]][selectedPiece[1]] = 0; // Remove piece from original position
            newBoard[rowIndex][colIndex] = playerColor === 'black' ? 1 : 2; // Place piece in new position
            setBoard(newBoard);

            // Update kings set if needed
            const newKings = new Set(kings);
            if (kings.has(`${captureRow},${captureCol}`)) {
              newKings.delete(`${captureRow},${captureCol}`);
            }
            if (kings.has(`${selectedPiece[0]},${selectedPiece[1]}`)) {
              newKings.delete(`${selectedPiece[0]},${selectedPiece[1]}`);
              newKings.add(`${rowIndex},${colIndex}`);
            }
            setKings(newKings);

            setSelectedPiece([rowIndex, colIndex]);

            // For kings, recalculate all possible sequences from the new position
            const isCurrentKing = newKings.has(`${rowIndex},${colIndex}`);
            if (isCurrentKing) {
              // Calculate the direction of the current move
              const dx = Math.sign(rowIndex - selectedPiece[0]);
              const dy = Math.sign(colIndex - selectedPiece[1]);
              const currentDirection = [dx, dy];

              const newSequences = findKingCaptureSequences(
                rowIndex,
                colIndex,
                newBoard,
                { moves: [], captures: [] }, // Start fresh sequence
                currentDirection // Pass the current direction
              );

              const maxNewCaptures = Math.max(...newSequences.map(seq => seq.captures.length), 0);

              if (maxNewCaptures > 0) {
                const longestNewSequences = newSequences.filter(seq =>
                  seq.captures.length === maxNewCaptures
                );

                const nextMoves = longestNewSequences.map(seq => seq.moves[0]);
                const uniqueNextMoves = nextMoves.filter((move, index, self) =>
                  self.findIndex(m => m[0] === move[0] && m[1] === move[1]) === index
                );

                setValidMoves(uniqueNextMoves);
                setCurrentSequence(longestNewSequences[0]);
                setSequencePath(longestNewSequences.flatMap(seq => seq.moves));
              } else {
                // No more captures possible
                setSelectedPiece(null);
                setValidMoves([]);
                setSequencePath([]);
                setCurrentSequence(null);
              }
            } else {
              // Regular piece capture continues with the original sequence
              const remainingSequences = findCaptureSequences(rowIndex, colIndex);
              const maxRemainingCaptures = Math.max(...remainingSequences.map(seq => seq.captures.length));
              const longestRemainingSequences = remainingSequences.filter(seq =>
                seq.captures.length === maxRemainingCaptures
              );

              const nextMoves = longestRemainingSequences.map(seq => seq.moves[0]);
              const uniqueNextMoves = nextMoves.filter((move, index, self) =>
                self.findIndex(m => m[0] === move[0] && m[1] === move[1]) === index
              );

              setValidMoves(uniqueNextMoves);
              setCurrentSequence(longestRemainingSequences[0]);
              setSequencePath(longestRemainingSequences.flatMap(seq => seq.moves));
            }
          } else {
            // Sequence is complete, reset everything
            setSelectedPiece(null);
            setValidMoves([]);
            setSequencePath([]);
            setCurrentSequence(null);
          }
        }
      } else if (isValidMove) {
        // Regular move
        onMove(selectedPiece, [rowIndex, colIndex]);
        setSelectedPiece(null);
        setValidMoves([]);
        setSequencePath([]);
        setCurrentSequence(null);
      }
    }
  };

  const findMaximumCaptures = (): number => {
    let maxCaptures = 0;
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if ((playerColor === 'black' && piece === 1) ||
            (playerColor === 'white' && piece === 2)) {
          const sequences = findCaptureSequences(row, col);
          if (sequences.length > 0) {
            const maxForPiece = Math.max(...sequences.map(seq => seq.captures.length));
            maxCaptures = Math.max(maxCaptures, maxForPiece);
          }
        }
      }
    }
    return maxCaptures;
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
                validMoves.some(([row, col]) => row === rowIndex && col === colIndex) &&
                  "ring-2 ring-green-500 ring-inset",
                // Show intermediate moves with a different style
                sequencePath.some(([row, col]) => row === rowIndex && col === colIndex) &&
                  !validMoves.some(([row, col]) => row === rowIndex && col === colIndex) &&
                  "ring-2 ring-green-300 ring-inset ring-opacity-50",
                isPlayerTurn && "hover:bg-amber-50"
              )}
              onClick={() => handleSquareClick(rowIndex, colIndex)}
            >
              {cell !== 0 && (
                <div className={cn(
                  "w-12 h-12 rounded-full flex items-center justify-center",
                  cell === 1 ? "bg-black" : "bg-white border-2 border-gray-300",
                  "shadow-md"
                )}>
                  {isKing(rowIndex, colIndex) && (
                    <div className="text-2xl text-amber-500">♔</div>
                  )}
                </div>
              )}
            </div>
          ))
        ))}
      </div>
    </div>
  );
}