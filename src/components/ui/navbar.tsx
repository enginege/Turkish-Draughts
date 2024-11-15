import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '@/lib/firebase';
import { ref, onValue, remove, get, set, update } from 'firebase/database';
import { Button } from './button';
import { Bell, LogOut, User } from 'lucide-react';
import toast from 'react-hot-toast';

interface Notification {
  id: string;
  from: string;
  roomId: string;
  type: string;
  timestamp: number;
}

export function Navbar() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [username, setUsername] = useState('');
  const [editingUsername, setEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState('');

  useEffect(() => {
    if (!auth.currentUser) return;

    // Get current username
    const userRef = ref(db, `usernames`);
    onValue(userRef, (snapshot) => {
      const data = snapshot.val() || {};
      const currentUsername = Object.keys(data).find(key => data[key] === auth.currentUser?.uid);
      setUsername(currentUsername || '');
    });

    const notificationsRef = ref(db, `notifications/${auth.currentUser.uid}`);
    const unsubscribe = onValue(notificationsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const notificationsList = Object.entries(data).map(([id, notification]: [string, any]) => ({
          id,
          ...notification,
        }));
        setNotifications(notificationsList);
      } else {
        setNotifications([]);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleAcceptInvite = async (notification: Notification) => {
    try {
      if (!auth.currentUser) return;

      // Check if the room still exists and has space
      const roomRef = ref(db, `rooms/${notification.roomId}`);
      const gameRef = ref(db, `games/${notification.roomId}`);

      // Get current room and game state
      const [roomSnapshot, gameSnapshot] = await Promise.all([
        get(roomRef),
        get(gameRef)
      ]);

      const roomData = roomSnapshot.val();
      const gameData = gameSnapshot.val();

      if (!roomData) {
        toast.error('This game room no longer exists');
        await remove(ref(db, `notifications/${auth.currentUser.uid}/${notification.id}`));
        return;
      }

      if (roomData.players >= 2) {
        toast.error('This game room is already full');
        await remove(ref(db, `notifications/${auth.currentUser.uid}/${notification.id}`));
        return;
      }

      // Check if player is already in the room
      if (gameData?.players?.[auth.currentUser.uid]) {
        await remove(ref(db, `notifications/${auth.currentUser.uid}/${notification.id}`));
        navigate(`/room/${notification.roomId}`);
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
          }
        })
      ]);

      // Remove the notification
      await remove(ref(db, `notifications/${auth.currentUser.uid}/${notification.id}`));

      // Navigate to the game room
      navigate(`/room/${notification.roomId}`);
      setShowNotifications(false);
      toast.success('Joined the room successfully!');
    } catch (error) {
      console.error('Error accepting invite:', error);
      toast.error('Failed to accept invite');
    }
  };

  const handleDeclineInvite = async (notificationId: string) => {
    try {
      if (!auth.currentUser) return;
      await remove(ref(db, `notifications/${auth.currentUser.uid}/${notificationId}`));
      toast.success('Invitation declined');
    } catch (error) {
      console.error('Error declining invite:', error);
      toast.error('Failed to decline invite');
    }
  };

  const handleSignOut = async () => {
    try {
      await auth.signOut();
      navigate('/');
      toast.success('Signed out successfully');
    } catch (error) {
      console.error('Error signing out:', error);
      toast.error('Failed to sign out');
    }
  };

  const handleUpdateUsername = async () => {
    if (!auth.currentUser || !newUsername.trim()) return;

    try {
      const usernamesRef = ref(db, 'usernames');
      const snapshot = await get(usernamesRef);
      const usernames = snapshot.val() || {};

      // Check if username is taken
      if (usernames[newUsername]) {
        toast.error('Username is already taken');
        return;
      }

      // Remove old username if exists
      if (username) {
        await remove(ref(db, `usernames/${username}`));
      }

      // Set new username
      await set(ref(db, `usernames/${newUsername}`), auth.currentUser.uid);
      setUsername(newUsername);
      setEditingUsername(false);
      setNewUsername('');
      toast.success('Username updated successfully');
    } catch (error) {
      console.error('Error updating username:', error);
      toast.error('Failed to update username');
    }
  };

  return (
    <div className="fixed left-0 top-0 h-full w-20 bg-white shadow-lg flex flex-col items-center py-6 z-50">
      <div className="flex-1 flex flex-col items-center space-y-6">
        <div className="relative">
          <Button
            variant="ghost"
            className="rounded-full p-3"
            onClick={() => setShowProfile(!showProfile)}
          >
            <User className="h-6 w-6" />
          </Button>

          {showProfile && (
            <div className="absolute left-20 top-0 w-64 bg-white rounded-lg shadow-lg p-4">
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold mb-1">Profile</h3>
                  <p className="text-sm text-gray-600">
                    {auth.currentUser?.displayName || 'Anonymous'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {auth.currentUser?.isAnonymous ? 'Guest Account' : auth.currentUser?.email}
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold mb-1">Username</h3>
                  {auth.currentUser?.isAnonymous ? (
                    <p className="text-sm text-gray-600">
                      {username || 'Guest User'}
                      <span className="text-xs text-gray-500 ml-2">(Cannot be changed)</span>
                    </p>
                  ) : (
                    editingUsername ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={newUsername}
                          onChange={(e) => setNewUsername(e.target.value.toLowerCase())}
                          className="w-full px-2 py-1 text-sm border rounded"
                          placeholder="Enter new username"
                          pattern="[a-z0-9]+"
                          title="Username can only contain lowercase letters and numbers"
                        />
                        <div className="flex space-x-2">
                          <Button size="sm" onClick={handleUpdateUsername}>
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingUsername(false)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-gray-600">
                          {username || 'No username set'}
                        </p>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingUsername(true)}
                        >
                          Edit
                        </Button>
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="relative">
          <Button
            variant="ghost"
            className="rounded-full p-3"
            onClick={() => setShowNotifications(!showNotifications)}
          >
            <Bell className="h-6 w-6" />
            {notifications.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                {notifications.length}
              </span>
            )}
          </Button>

          {showNotifications && notifications.length > 0 && (
            <div className="absolute left-20 top-0 w-64 bg-white rounded-lg shadow-lg p-4">
              <h3 className="text-sm font-semibold mb-2">Notifications</h3>
              <div className="space-y-2">
                {notifications.map((notification) => (
                  <div key={notification.id} className="p-2 bg-gray-50 rounded">
                    <p className="text-sm mb-2">
                      Invite from {notification.from}
                    </p>
                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        onClick={() => handleAcceptInvite(notification)}
                      >
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeclineInvite(notification.id)}
                      >
                        Decline
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <Button
        variant="ghost"
        className="rounded-full p-3"
        onClick={handleSignOut}
      >
        <LogOut className="h-6 w-6" />
      </Button>
    </div>
  );
}