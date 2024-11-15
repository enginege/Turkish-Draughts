import { useState } from 'react';
import { auth } from '@/lib/firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInAnonymously,
  updateProfile
} from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { User2, KeyRound, UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import { ref, get, set } from 'firebase/database';
import { db } from '@/lib/firebase';

export function AuthForm() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const usernamesRef = ref(db, 'usernames');
        const snapshot = await get(usernamesRef);
        const usernames = snapshot.val() || {};

        if (usernames[username]) {
          toast.error('Username is already taken');
          return;
        }

        const userCredential = await createUserWithEmailAndPassword(auth, email, password);

        await set(ref(db, `usernames/${username}`), userCredential.user.uid);

        await updateProfile(userCredential.user, {
          displayName: username
        });
      }
      toast.success(isLogin ? 'Welcome back!' : 'Account created successfully!');
    } catch (error) {
      console.error('Authentication error:', error);
      toast.error('Authentication failed. Please try again.');
    }
  };

  const handleGuestLogin = async () => {
    try {
      const guestNumber = Math.floor(Math.random() * 10000);
      const guestUsername = `guest${guestNumber}`;

      // Check if generated username exists
      const usernamesRef = ref(db, 'usernames');
      const snapshot = await get(usernamesRef);
      const usernames = snapshot.val() || {};

      if (usernames[guestUsername]) {
        // If username exists, try again
        handleGuestLogin();
        return;
      }

      const userCredential = await signInAnonymously(auth);

      // Set username in database
      await set(ref(db, `usernames/${guestUsername}`), userCredential.user.uid);

      // Set display name
      await updateProfile(userCredential.user, {
        displayName: guestUsername
      });

      toast.success('Logged in as guest');
    } catch (error) {
      console.error('Guest login error:', error);
      toast.error('Guest login failed. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Turkish Draughts
          </h1>
          <p className="text-gray-600">
            {isLogin ? 'Welcome back!' : 'Create your account'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required={!isLogin}
                pattern="[a-z0-9]+"
                title="Username can only contain lowercase letters and numbers"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <Button type="submit" className="w-full" size="lg">
            {isLogin ? (
              <>
                <KeyRound className="mr-2 h-5 w-5" />
                Sign In
              </>
            ) : (
              <>
                <UserPlus className="mr-2 h-5 w-5" />
                Sign Up
              </>
            )}
          </Button>
        </form>

        <div className="mt-6">
          <Button
            onClick={handleGuestLogin}
            variant="secondary"
            className="w-full"
            size="lg"
          >
            <User2 className="mr-2 h-5 w-5" />
            Play as Guest
          </Button>
        </div>

        <p className="mt-4 text-center text-sm text-gray-600">
          {isLogin ? "Don't have an account? " : 'Already have an account? '}
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            {isLogin ? 'Sign Up' : 'Sign In'}
          </button>
        </p>
      </div>
    </div>
  );
}