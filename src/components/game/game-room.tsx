import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, auth } from '@/lib/firebase';
import { ref, onValue, set, update, get } from 'firebase/database';
import { Board } from './board';
import { Button } from '../ui/button';
import { ArrowLeft, Send } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import toast from 'react-hot-toast';

interface GameState {
  board: number[][];
  currentTurn: string;
  players: {
    [key: string]: {
      name: string;
      color: 'black' | 'white';
    };
  };
}

export function GameRoom() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [inviteUsername, setInviteUsername] = useState('');
  const [senderUsername, setSenderUsername] = useState('');
  const [playerColor, setPlayerColor] = useState<'black' | 'white'>();

  const handleLeaveRoom = useCallback(async () => {
    if (!roomId || !user) return;

    try {
      const [roomRef, gameRef] = [
        ref(db, `rooms/${roomId}`),
        ref(db, `games/${roomId}`)
      ];

      const [roomSnapshot, gameSnapshot] = await Promise.all([
        get(roomRef),
        get(gameRef)
      ]);

      const roomData = roomSnapshot.val();
      const gameData = gameSnapshot.val();

      if (!roomData || !gameData) return;

      // Remove the player from the game
      const updatedPlayers = { ...gameData.players };
      delete updatedPlayers[user.uid];

      // Determine the new current turn
      const remainingPlayers = Object.keys(updatedPlayers);
      const newCurrentTurn = remainingPlayers.length > 0 ? remainingPlayers[0] : null;

      // Update room and game state
      const updatePromises = [
        update(roomRef, { players: Math.max(1, roomData.players - 1) })
      ];

      if (remainingPlayers.length === 0) {
        // If no players remain, remove the game and room
        updatePromises.push(set(gameRef, null));
        updatePromises.push(set(roomRef, null));
      } else {
        updatePromises.push(
          update(gameRef, {
            players: updatedPlayers,
            currentTurn: newCurrentTurn,
          })
        );
      }

      await Promise.all(updatePromises);

      if (remainingPlayers.length === 0) {
        toast.success('Room is now empty and has been removed.');
      } else {
        toast.success('You have left the room.');
      }
    } catch (error) {
      console.error('Error leaving room:', error);
    }
  }, [roomId, user]);

  useEffect(() => {
    if (!roomId || !user) return;

    const gameRef = ref(db, `games/${roomId}`);
    const unsubscribe = onValue(gameRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setGameState(data);
      }
    });

    return () => {
      handleLeaveRoom().catch(error => {
        console.error('Error leaving room on cleanup:', error);
      });
      unsubscribe();
    };
  }, [roomId, user, handleLeaveRoom]);

  useEffect(() => {
    if (!auth.currentUser) return;

    // Get sender's username
    const userRef = ref(db, 'usernames');
    const unsubscribe = onValue(userRef, (snapshot) => {
      const data = snapshot.val() || {};
      const currentUsername = Object.keys(data).find(key => data[key] === auth.currentUser?.uid);
      setSenderUsername(currentUsername || '');
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const gameRef = ref(db, `games/${roomId}`);
    const unsubscribe = onValue(gameRef, (snapshot) => {
      const data = snapshot.val();
      if (data?.players && auth.currentUser) {
        // Set the player's color based on their entry in the players object
        const playerData = data.players[auth.currentUser.uid];
        if (playerData) {
          setPlayerColor(playerData.color);
        }
      }
    });

    return () => unsubscribe();
  }, [roomId]);

  const handleMove = async (from: number[], to: number[]) => {
    if (!roomId || !user || !gameState) return;
    if (gameState.currentTurn !== user.uid) return;

    const gameRef = ref(db, `games/${roomId}`);
    const newBoard = JSON.parse(JSON.stringify(gameState.board));
    const [fromRow, fromCol] = from;
    const [toRow, toCol] = to;

    // Check if it's a capture move
    if (Math.abs(toRow - fromRow) === 2) {
      // Remove the captured piece
      const middleRow = (fromRow + toRow) / 2;
      newBoard[middleRow][fromCol] = 0;
    }

    // Move the piece
    newBoard[toRow][toCol] = newBoard[fromRow][fromCol];
    newBoard[fromRow][fromCol] = 0;

    await set(gameRef, {
      ...gameState,
      board: newBoard,
      currentTurn: Object.keys(gameState.players).find(id => id !== user.uid),
    });
  };

  const handleInvite = async () => {
    if (!roomId || !user || !inviteUsername.trim()) return;

    try {
      // Get user ID from username
      const usernamesRef = ref(db, `usernames/${inviteUsername}`);
      const snapshot = await get(usernamesRef);
      const targetUserId = snapshot.val();

      if (!targetUserId) {
        toast.error('User not found');
        return;
      }

      const notificationRef = ref(db, `notifications/${targetUserId}/${roomId}`);
      await set(notificationRef, {
        type: 'invite',
        from: senderUsername || user.displayName || 'Anonymous',
        roomId,
        timestamp: Date.now(),
      });

      toast.success('Invitation sent!');
      setInviteUsername('');
    } catch (error) {
      console.error('Error sending invitation:', error);
      toast.error('Failed to send invitation');
    }
  };

  const handleNavigateToLobby = () => {
    navigate('/');
  };

  if (!gameState) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const isPlayerTurn = gameState.currentTurn === user?.uid;
  const opponent = Object.entries(gameState.players).find(([id]) => id !== user?.uid);

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={handleNavigateToLobby}
            className="text-gray-600"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Lobby
          </Button>
          <div className="text-gray-600">
            {isPlayerTurn ? "Your turn" : "Opponent's turn"}
          </div>
        </div>

        <div className="flex flex-col items-center">
          <div className="mb-4 text-lg font-semibold text-gray-800">
            Playing as {playerColor}
          </div>

          <div className="flex items-center justify-between w-full max-w-2xl mb-4">
            <div className="text-lg font-medium">
              {user?.displayName || 'Player 1'}
            </div>
            <div className="text-lg font-medium">
              {opponent ? opponent[1].name : (
                <div className="flex items-center space-x-2">
                  <span className="text-gray-500">Waiting for opponent</span>
                  <input
                    type="text"
                    value={inviteUsername}
                    onChange={(e) => setInviteUsername(e.target.value)}
                    placeholder="Enter username to invite"
                    className="px-3 py-1 border rounded"
                  />
                  <Button
                    size="sm"
                    onClick={handleInvite}
                    disabled={!inviteUsername.trim()}
                  >
                    <Send className="h-4 w-4 mr-1" />
                    Invite
                  </Button>
                </div>
              )}
            </div>
          </div>

          <Board
            gameId={roomId!}  // Non-null assertion
            isPlayerTurn={isPlayerTurn}
            onMove={handleMove}
            playerColor={playerColor || 'black'}
          />
        </div>
      </div>
    </div>
  );
}