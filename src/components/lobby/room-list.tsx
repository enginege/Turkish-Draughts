import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '@/lib/firebase';
import { ref, onValue, update, get } from 'firebase/database';
import { Button } from '@/components/ui/button';
import { Lock, Unlock, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

interface GameRoom {
  id: string;
  name: string;
  isPrivate: boolean;
  password?: string;
  players: number;
  createdAt: number;
  createdBy: string;
}

export function RoomList() {
  const [rooms, setRooms] = useState<GameRoom[]>([]);
  const [password, setPassword] = useState('');
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [joiningRoom, setJoiningRoom] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const roomsRef = ref(db, 'rooms');
    const unsubscribe = onValue(roomsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const roomList = Object.entries(data).map(([id, room]: [string, any]) => ({
          id,
          ...room,
        }));
        setRooms(roomList);
      } else {
        setRooms([]);
      }
    });

    return () => unsubscribe();
  }, []);

  const joinRoom = async (roomId: string) => {
    if (!auth.currentUser || joiningRoom) return;

    try {
      setJoiningRoom(true);
      const roomRef = ref(db, `rooms/${roomId}`);
      const gameRef = ref(db, `games/${roomId}`);

      // Get current game state
      const [roomSnapshot, gameSnapshot] = await Promise.all([
        get(roomRef),
        get(gameRef)
      ]);

      const roomData = roomSnapshot.val();
      const gameData = gameSnapshot.val();

      if (!roomData) {
        toast.error('Room no longer exists');
        return;
      }

      // Check if room is already full
      if (roomData.players >= 2) {
        toast.error('Room is already full');
        return;
      }

      // Check if player is already in the room
      if (gameData?.players?.[auth.currentUser.uid]) {
        navigate(`/room/${roomId}`);
        return;
      }

      // Initialize gameData.players if undefined
      const currentPlayers = gameData?.players ?? {};

      // Update room and game state
      await Promise.all([
        update(roomRef, {
          players: roomData.players + 1
        }),
        update(gameRef, {
          players: {
            ...currentPlayers,
            [auth.currentUser.uid]: {
              name: auth.currentUser.displayName || 'Player 2',
              color: 'white',
            }
          },
          currentTurn: gameData?.currentTurn || auth.currentUser.uid,
        })
      ]);

      toast.success('Joined the room successfully!');
      navigate(`/room/${roomId}`);
    } catch (error) {
      console.error('Error joining room:', error);
      toast.error('Failed to join room. Please try again.');
    } finally {
      setJoiningRoom(false);
    }
  };

  const handleJoin = async (room: GameRoom) => {
    if (!auth.currentUser) {
      toast.error('Please sign in to join a room');
      return;
    }

    if (room.isPrivate) {
      setSelectedRoom(room.id);
      return;
    }

    await joinRoom(room.id);
  };

  const handlePasswordSubmit = async (roomId: string) => {
    const room = rooms.find((r) => r.id === roomId);
    if (!room || !auth.currentUser) return;

    if (room.password !== password) {
      toast.error('Incorrect password');
      return;
    }

    await joinRoom(roomId);
    setSelectedRoom(null);
    setPassword('');
  };

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Room Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Players
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {rooms.map((room) => (
              <tr key={room.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    {room.isPrivate ? (
                      <Lock className="h-4 w-4 text-gray-400 mr-2" />
                    ) : (
                      <Unlock className="h-4 w-4 text-gray-400 mr-2" />
                    )}
                    <span className="text-sm font-medium text-gray-900">
                      {room.name}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center text-sm text-gray-500">
                    <Users className="h-4 w-4 mr-1" />
                    {room.players}/2
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={cn(
                      'px-2 inline-flex text-xs leading-5 font-semibold rounded-full',
                      room.players === 2
                        ? 'bg-red-100 text-red-800'
                        : 'bg-green-100 text-green-800'
                    )}
                  >
                    {room.players === 2 ? 'Full' : 'Available'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  {selectedRoom === room.id ? (
                    <div className="flex items-center justify-end space-x-2">
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter password"
                        className="px-2 py-1 border rounded"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handlePasswordSubmit(room.id)}
                        disabled={joiningRoom}
                      >
                        Submit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedRoom(null)}
                        disabled={joiningRoom}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={room.players === 2 || joiningRoom}
                      onClick={() => handleJoin(room)}
                    >
                      {joiningRoom ? 'Joining...' : 'Join'}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}