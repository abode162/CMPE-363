import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { register, claimGuestUrls } from '../api';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const navigate = useNavigate();
  const { loginUser } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await register({ name, email, password });
      loginUser(res.data.user, res.data.token);

      // Try to claim any guest URLs
      try {
        await claimGuestUrls();
      } catch {
        // Ignore claim errors
      }

      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Brand Panel */}
      <div className="hidden lg:flex lg:w-5/12 bg-slate-900 p-12 flex-col justify-between">
        <Link to="/" className="text-xl font-semibold text-white tracking-tight">
          Shortify
        </Link>

        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight mb-4">
            Start shortening today
          </h2>
          <p className="text-slate-400 text-lg leading-relaxed mb-8">
            Create an account to access powerful features and detailed analytics.
          </p>

          <div className="space-y-4">
            <div className="flex items-center gap-3 text-slate-300">
              <svg className="w-5 h-5 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Unlimited short URLs</span>
            </div>
            <div className="flex items-center gap-3 text-slate-300">
              <svg className="w-5 h-5 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Detailed click analytics</span>
            </div>
            <div className="flex items-center gap-3 text-slate-300">
              <svg className="w-5 h-5 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Custom short codes</span>
            </div>
            <div className="flex items-center gap-3 text-slate-300">
              <svg className="w-5 h-5 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>QR code generation</span>
            </div>
          </div>
        </div>

        <p className="text-slate-500 text-sm">
          Free forever. No credit card required.
        </p>
      </div>

      {/* Right Side - Form */}
      <div className="w-full lg:w-7/12 flex items-center justify-center p-8 bg-slate-50">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <Link to="/" className="lg:hidden text-xl font-semibold text-slate-900 tracking-tight inline-block mb-8">
              Shortify
            </Link>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Create your account</h1>
            <p className="text-slate-600 mt-2">Get started with Shortify today</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-3 bg-red-50 border border-red-100 text-red-700 rounded-lg flex items-start gap-2.5 text-sm">
                <svg className="w-5 h-5 flex-shrink-0 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Full name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                required
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                required
                minLength={6}
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
              />
              <p className="mt-1.5 text-xs text-slate-500">Must be at least 6 characters</p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Creating account...
                </span>
              ) : 'Create account'}
            </button>

            <p className="text-xs text-slate-500 text-center">
              By creating an account, you agree to our Terms of Service and Privacy Policy
            </p>
          </form>

          <div className="mt-8 text-center">
            <p className="text-slate-600">
              Already have an account?{' '}
              <Link to="/login" className="text-teal-600 hover:text-teal-700 font-medium">
                Sign in
              </Link>
            </p>
          </div>

          <div className="mt-6 text-center">
            <Link to="/" className="text-sm text-slate-500 hover:text-slate-700">
              &larr; Back to home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
