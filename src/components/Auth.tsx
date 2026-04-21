'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Mail, Lock, LogIn, UserPlus } from 'lucide-react';

export default function Auth({ onSignIn }: { onSignIn: () => void }) {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        onSignIn();
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            // emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (error) throw error;
        setMessage('Check your email for the confirmation link!');
      }
    } catch (error: any) {
      setError(error.error_description || error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container" style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minHeight: '60vh', padding: '2rem', textAlign: 'center'
    }}>
      <h2 style={{ color: 'var(--clr-primary)', marginBottom: '0.5rem', fontSize: '1.75rem' }}>
        {isLogin ? 'Welcome Back' : 'Create Account'}
      </h2>
      <p style={{ color: 'var(--clr-text-muted)', marginBottom: '2rem' }}>
        {isLogin ? 'Sign in to access your durian leaf scans.' : 'Sign up to start diagnosing your durian trees.'}
      </p>

      {error && <div style={{ background: '#fef2f2', color: '#ef4444', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', width: '100%', maxWidth: '320px', fontSize: '0.875rem' }}>{error}</div>}
      {message && <div style={{ background: '#ecfdf5', color: '#10b981', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', width: '100%', maxWidth: '320px', fontSize: '0.875rem' }}>{message}</div>}

      <form onSubmit={handleAuth} style={{ width: '100%', maxWidth: '320px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ position: 'relative' }}>
          <Mail size={20} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--clr-text-muted)' }} />
          <input
            type="email"
            placeholder="Your email address"
            value={email}
            required
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: '100%', padding: '0.75rem 0.75rem 0.75rem 2.5rem', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none', background: 'var(--clr-surface)', color: 'var(--clr-text)' }}
          />
        </div>
        
        <div style={{ position: 'relative' }}>
          <Lock size={20} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--clr-text-muted)' }} />
          <input
            type="password"
            placeholder="Your password"
            value={password}
            required
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: '100%', padding: '0.75rem 0.75rem 0.75rem 2.5rem', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none', background: 'var(--clr-surface)', color: 'var(--clr-text)' }}
          />
        </div>

        <button className="btn-primary" type="submit" disabled={loading} style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'center' }}>
          {loading ? 'Processing...' : (isLogin ? <><LogIn size={20} /> Sign In</> : <><UserPlus size={20} /> Sign Up</>)}
        </button>
      </form>

      <button 
        onClick={() => setIsLogin(!isLogin)} 
        style={{ background: 'none', border: 'none', color: 'var(--clr-primary)', marginTop: '1.5rem', cursor: 'pointer', fontSize: '0.9rem', fontWeight: '500' }}
      >
        {isLogin ? "Don't have an account? Sign Up" : 'Already have an account? Sign In'}
      </button>
    </div>
  );
}
