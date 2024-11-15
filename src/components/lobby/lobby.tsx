import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '@/lib/firebase';
import { ref, push, set } from 'firebase/database';
import { RoomList } from './room-list';
import { Button } from '../ui/button';
import { Plus } from 'lucide-react';
import toast from 'react-hot-toast';

export function Lobby() {
  const navigate = useNavigate();
  const [isCreating, setIsCreating] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [password, setPassword] = useState('');

  const handleCreateRoom = async () => {
    if (!roomName.trim()) {
      toast.error('Please enter a room name');
      return;
    }

    if (isPrivate && !password.trim()) {
      toast.error('Please enter a password for the private room');
      return;
    }

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        toast.error('You must be logged in to create a room');
        return;
      }

      const roomRef = push(ref(db, 'rooms'));
      const gameRef = ref(db, `games/${roomRef.key}`);

      // Initialize empty board with 8 rows instead of 6
      const emptyBoard = Array(8).fill(null).map(() => Array(8).fill(0));

      // Set up initial pieces
      for (let i = 1; i < 3; i++) {
        for (let j = 0; j < 8; j++) {
          emptyBoard[i][j] = 1; // Black pieces
        }
      }
      for (let i = 5; i < 7; i++) {
        for (let j = 0; j < 8; j++) {
          emptyBoard[i][j] = 2; // White pieces
        }
      }

      await Promise.all([
        set(roomRef, {
          name: roomName,
          isPrivate,
          ...(isPrivate && { password }),
          players: 1,
          createdAt: Date.now(),
          createdBy: currentUser.uid,
        }),
        set(gameRef, {
          board: emptyBoard,
          currentTurn: currentUser.uid,
          players: {
            [currentUser.uid]: {
              name: currentUser.displayName || 'Player 1',
              color: 'black',
            },
          },
        }),
      ]);

      navigate(`/room/${roomRef.key}`);
    } catch (error) {
      console.error('Error creating room:', error);
      toast.error('Failed to create room');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Game Lobby</h1>
          <Button
            onClick={() => setIsCreating(true)}
            className="flex items-center"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Room
          </Button>
        </div>

        {isCreating && (
          <div className="mb-6 bg-white p-4 rounded-lg shadow-md">
            <h2 className="text-lg font-semibold mb-4">Create New Room</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Room Name
                </label>
                <input
                  type="text"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="private"
                  checked={isPrivate}
                  onChange={(e) => setIsPrivate(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="private" className="ml-2 text-sm text-gray-700">
                  Private Room
                </label>
              </div>
              {isPrivate && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Room Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              )}
              <div className="flex gap-2">
                <Button onClick={handleCreateRoom}>Create</Button>
                <Button
                  variant="outline"
                  onClick={() => setIsCreating(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}

        <RoomList />
      </div>
    </div>
  );
}