import React, { useState, useEffect } from 'react';

interface User {
  id: string;
  email: string;
  username: string;
}

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (user: User, token: string) => void;
}

interface AuthApiResponse {
  user?: User;
  token?: string;
  error?: string;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onAuthSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Validate existing token session on load
  useEffect(() => {
    const checkExistingSession = async () => {
      const token = localStorage.getItem('bet_fund_token');
      if (!token) return;

      try {
        console.log('[AuthModal] Validating active session token...');
        const response = await fetch('/api/auth/me', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (response.ok) {
          const data = (await response.json()) as AuthApiResponse;
          if (data.user) {
            console.log('[AuthModal] Session restored for user:', data.user.email);
            onAuthSuccess(data.user, token);
          }
        } else {
          console.warn('[AuthModal] Invalid or expired token session removed.');
          localStorage.removeItem('bet_fund_token');
        }
      } catch (err) {
        console.error('[AuthModal] Session validation request error:', err);
      }
    };

    checkExistingSession();
  }, [onAuthSuccess]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    e.stopPropagation();

    console.log('[AuthModal] Form submit event intercepted');
    
    setError(null);

    if (!email || !password || (!isLogin && !username)) {
      const missingFieldMsg = 'Please fill out all required fields.';
      console.warn('[AuthModal] Validation failed:', missingFieldMsg);
      setError(missingFieldMsg);
      return;
    }

    setIsLoading(true);

    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
    const payload = isLogin ? { email, password } : { email, password, username };

    console.log(`[AuthModal] Sending POST request to ${endpoint}`, payload);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      console.log(`[AuthModal] Response status received: ${response.status}`);
      const data = (await response.json()) as AuthApiResponse;

      if (!response.ok) {
        throw new Error(data.error || 'Authentication failed. Please check your credentials.');
      }

      if (data.token && data.user) {
        console.log('[AuthModal] Auth successful, storing token:', data.token);
        localStorage.setItem('bet_fund_token', data.token);
        onAuthSuccess(data.user, data.token);
        onClose();
      } else {
        throw new Error('Invalid response structure from authentication server.');
      }
    } catch (err: any) {
      console.error('[AuthModal] Authentication error caught:', err);
      setError(err.message || 'Network error. Unable to connect to backend.');
    } finally {
      setIsLoading(false);
      console.log('[AuthModal] Form processing complete, loading state reset.');
    }
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      console.log('[AuthModal] Backdrop clicked, closing modal');
      onClose();
    }
  };

  return (
    <div 
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md pointer-events-auto cursor-pointer"
    >
      <div 
        className="relative w-full max-w-md p-8 rounded-2xl border border-amber-500/20 bg-zinc-950/90 shadow-[0_0_50px_rgba(212,175,55,0.15)] text-zinc-100 pointer-events-auto cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          onClick={() => {
            console.log('[AuthModal] Close button clicked');
            onClose();
          }}
          className="absolute top-4 right-4 text-zinc-400 hover:text-amber-400 transition-colors text-xl font-bold cursor-pointer"
          type="button"
          aria-label="Close modal"
        >
          ✕
        </button>

        <div className="mb-6 text-center">
          <h2 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-amber-200 via-amber-400 to-amber-600 bg-clip-text text-transparent">
            {isLogin ? 'Welcome Back' : 'Join bet.fund'}
          </h2>
          <p className="text-xs text-zinc-400 mt-2 uppercase tracking-widest">
            {isLogin ? 'Access your elite portfolio' : 'Create your luxury account'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg border border-red-500/30 bg-red-950/40 text-red-300 text-sm text-center font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="block text-xs font-semibold text-amber-300/80 uppercase mb-1">Username</label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="HighRoller99"
                className="w-full px-4 py-3 rounded-xl bg-zinc-900/90 border border-zinc-800 text-zinc-100 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all placeholder:text-zinc-600 pointer-events-auto"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-amber-300/80 uppercase mb-1">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vip@bet.fund"
              className="w-full px-4 py-3 rounded-xl bg-zinc-900/90 border border-zinc-800 text-zinc-100 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all placeholder:text-zinc-600 pointer-events-auto"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-amber-300/80 uppercase mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full px-4 py-3 rounded-xl bg-zinc-900/90 border border-zinc-800 text-zinc-100 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all placeholder:text-zinc-600 pointer-events-auto"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 px-6 rounded-xl font-bold text-zinc-950 bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-600 hover:from-amber-300 hover:to-amber-500 active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(212,175,55,0.3)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer pointer-events-auto"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin"></span>
                Processing...
              </span>
            ) : (
              isLogin ? 'Sign In' : 'Register Account'
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => {
              console.log('[AuthModal] Toggling auth mode');
              setIsLogin(!isLogin);
              setError(null);
            }}
            className="text-xs text-zinc-400 hover:text-amber-400 transition-colors underline underline-offset-4 cursor-pointer pointer-events-auto"
          >
            {isLogin ? "Don't have an account? Register" : 'Already have an account? Log In'}
          </button>
        </div>
      </div>
    </div>
  );
};