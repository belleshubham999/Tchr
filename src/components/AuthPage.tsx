import React, { useState } from 'react';
import { Eye, EyeOff, Loader2, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';

const authImg = '/auth.webp';
const authImg2 = '/auth2.webp';

interface AuthPageProps {
  onSuccess: () => void;
}

export default function AuthPage({ onSuccess }: AuthPageProps) {
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot' | 'verify'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [verificationSent, setVerificationSent] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (authError) {
        setError(authError.message);
        return;
      }

      if (data.user) {
        onSuccess();
      }
    } catch (err) {
      setError('An error occurred during login');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName
          }
        }
      });

      if (authError) {
        setError(authError.message);
        return;
      }

      if (data.user) {
        setVerificationSent(true);
        setMode('verify');
      }
    } catch (err) {
      setError('An error occurred during signup');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}`
      });

      if (resetError) {
        setError(resetError.message);
        return;
      }

      setResetSent(true);
    } catch (err) {
      setError('Failed to send reset link');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-white overflow-hidden">
      {/* Left Side - Image & Welcome */}
      <div className="hidden lg:flex lg:w-1/2 relative items-center justify-center p-12" style={{ backgroundImage: `url(${authImg})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundColor: '#f5f5f5' }}>
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative z-10 text-center text-white max-w-md">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-5xl font-bold mb-4 tracking-tight">Welcome to Tchr</h1>
            <p className="text-xl text-white/90 leading-relaxed">
              Your AI-powered learning companion for smarter studying.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 relative" style={{ backgroundImage: `url(${authImg2})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundColor: '#f5f5f5' }}>
        <div className="absolute inset-0 pointer-events-none"></div>

        <AnimatePresence mode="wait">
          {mode === 'verify' && verificationSent ? (
            <motion.div
              key="verify"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative z-10 w-full max-w-md bg-white rounded-[40px] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] p-10 border border-zinc-100"
            >
              <div className="text-center">
                <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <CheckCircle2 size={32} className="text-emerald-600" />
                </div>
                <h2 className="text-3xl font-bold text-zinc-900 mb-2">Account Created!</h2>
                <p className="text-zinc-500 mb-6">
                  We've sent a confirmation email to <span className="font-semibold text-zinc-900">{email}</span>. You can now sign in with your credentials.
                </p>
                <button
                  onClick={() => {
                    setMode('login');
                    setEmail('');
                    setPassword('');
                    setFullName('');
                    setVerificationSent(false);
                  }}
                  className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white py-4 rounded-2xl font-bold text-lg shadow-xl shadow-indigo-500/20 hover:shadow-indigo-500/30 hover:-translate-y-0.5 active:translate-y-0 transition-all"
                >
                  Back to Sign In
                </button>
              </div>
            </motion.div>
          ) : mode === 'forgot' && resetSent ? (
            <motion.div
              key="reset-sent"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative z-10 w-full max-w-md bg-white rounded-[40px] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] p-10 border border-zinc-100"
            >
              <div className="text-center">
                <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <CheckCircle2 size={32} className="text-emerald-600" />
                </div>
                <h2 className="text-3xl font-bold text-zinc-900 mb-2">Reset link sent</h2>
                <p className="text-zinc-500 mb-6">
                  We've sent a password reset link to <span className="font-semibold text-zinc-900">{email}</span>. Check your email to reset your password.
                </p>
                <button
                  onClick={() => {
                    setMode('login');
                    setEmail('');
                    setPassword('');
                    setResetSent(false);
                  }}
                  className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white py-4 rounded-2xl font-bold text-lg shadow-xl shadow-indigo-500/20 hover:shadow-indigo-500/30 hover:-translate-y-0.5 active:translate-y-0 transition-all"
                >
                  Back to Sign In
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="auth-form"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="relative z-10 w-full max-w-md bg-white rounded-[40px] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] p-10 border border-zinc-100"
            >
              <div className="text-center mb-10">
                <h2 className="text-3xl font-bold text-zinc-900 mb-2">
                  {mode === 'login' ? 'Sign in to your account' : mode === 'signup' ? 'Create an account' : 'Reset password'}
                </h2>
                <p className="text-zinc-500">
                  {mode === 'login' ? 'Welcome back! Please enter your details.' : mode === 'signup' ? 'Join our community of learners.' : 'Enter your email to get a reset link.'}
                </p>
              </div>

              <form onSubmit={mode === 'login' ? handleLogin : mode === 'signup' ? handleSignup : handlePasswordReset} className="space-y-6">
                {mode === 'signup' && (
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2 ml-1">Full Name</label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="John Doe"
                      className="w-full px-5 py-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2 ml-1">Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-5 py-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                  />
                </div>

                {mode !== 'forgot' && (
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2 ml-1">Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full px-5 py-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors"
                      >
                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>
                  </div>
                )}

                {mode === 'login' && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setMode('forgot')}
                      className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
                    >
                      Forgot password?
                    </button>
                  </div>
                )}

                {error && (
                  <div className="p-4 bg-red-50 border border-red-100 text-red-600 text-sm rounded-2xl">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white py-4 rounded-2xl font-bold text-lg shadow-xl shadow-indigo-500/20 hover:shadow-indigo-500/30 hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isLoading ? <Loader2 size={20} className="animate-spin" /> : (mode === 'login' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Send Reset Link')}
                </button>
              </form>

              <div className="mt-8 text-center">
                <p className="text-zinc-500 text-sm">
                  {mode === 'login' ? (
                    <>Don't have an account? <button onClick={() => setMode('signup')} className="font-bold text-indigo-600 hover:underline">Sign up</button></>
                  ) : mode === 'signup' ? (
                    <>Already have an account? <button onClick={() => setMode('login')} className="font-bold text-indigo-600 hover:underline">Sign in</button></>
                  ) : (
                    <>Remember your password? <button onClick={() => setMode('login')} className="font-bold text-indigo-600 hover:underline">Sign in</button></>
                  )}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
