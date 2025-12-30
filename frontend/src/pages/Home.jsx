import { useState } from 'react';
import { Link } from 'react-router-dom';
import { createUrl } from '../api';
import { useAuth } from '../context/AuthContext';

export default function Home() {
  const { user } = useAuth();
  const [url, setUrl] = useState('');
  const [customCode, setCustomCode] = useState('');
  const [expiresInDays, setExpiresInDays] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setResult(null);
    setLoading(true);

    try {
      const data = { original_url: url };
      if (customCode.trim()) data.custom_code = customCode.trim();
      if (expiresInDays) data.expires_in_days = parseInt(expiresInDays);
      const res = await createUrl(data);
      setResult(res.data);
      setUrl('');
      setCustomCode('');
      setExpiresInDays('');
      setShowAdvanced(false);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create short URL');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(result.short_url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Navigation */}
      <nav className="border-b border-slate-200 sticky top-0 z-50 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link to="/" className="text-xl font-semibold text-slate-900 tracking-tight">
            Shortify
          </Link>
          <div className="flex items-center gap-2">
            {user ? (
              <>
                <Link
                  to="/dashboard"
                  className="px-4 py-2 text-slate-600 hover:text-slate-900 font-medium rounded-lg hover:bg-slate-100"
                >
                  Dashboard
                </Link>
                <div className="flex items-center gap-2.5 pl-3 border-l border-slate-200">
                  <div className="w-8 h-8 bg-teal-600 rounded-full flex items-center justify-center text-white font-medium text-sm">
                    {user.name?.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-slate-700 font-medium text-sm hidden sm:block">{user.name}</span>
                </div>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="px-4 py-2 text-slate-600 hover:text-slate-900 font-medium rounded-lg hover:bg-slate-100"
                >
                  Sign in
                </Link>
                <Link
                  to="/register"
                  className="px-4 py-2 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 active:scale-[0.98]"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="flex-1 flex items-center justify-center px-6 py-16 sm:py-24">
        <div className="w-full max-w-xl">
          {/* Hero Text */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-teal-50 text-teal-700 rounded-md text-sm font-medium mb-6 border border-teal-100">
              <span className="w-1.5 h-1.5 bg-teal-500 rounded-full"></span>
              Fast, secure, trackable
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 tracking-tight mb-4 leading-[1.1]">
              Short links,
              <br />
              <span className="text-teal-600">big results</span>
            </h1>
            <p className="text-lg text-slate-600 max-w-md mx-auto leading-relaxed">
              Create memorable short URLs and track every click with detailed analytics.
            </p>
          </div>

          {/* URL Form */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Your long URL
                </label>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com/your-very-long-url"
                  required
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
                />
              </div>

              {/* Advanced Options Toggle */}
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
              >
                <svg className={`w-4 h-4 transition-transform duration-200 ${showAdvanced ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
                Advanced options
              </button>

              {/* Advanced Options */}
              {showAdvanced && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Custom code</label>
                    <input
                      type="text"
                      value={customCode}
                      onChange={(e) => setCustomCode(e.target.value)}
                      placeholder="my-custom-link"
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Expiration</label>
                    <select
                      value={expiresInDays}
                      onChange={(e) => setExpiresInDays(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
                    >
                      <option value="">Never expires</option>
                      <option value="1">1 day</option>
                      <option value="7">7 days</option>
                      <option value="30">30 days</option>
                      <option value="90">90 days</option>
                      <option value="365">1 year</option>
                    </select>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Shortening...
                  </span>
                ) : 'Shorten URL'}
              </button>
            </form>

            {/* Error Message */}
            {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-100 text-red-700 rounded-lg flex items-start gap-2.5 text-sm">
                <svg className="w-5 h-5 flex-shrink-0 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            {/* Success Result */}
            {result && (
              <div className="mt-5 p-4 bg-emerald-50 border border-emerald-100 rounded-lg">
                <div className="flex items-center gap-2 text-emerald-700 mb-3">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-medium">Your short URL is ready</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={result.short_url}
                    className="flex-1 px-3 py-2.5 bg-white border border-slate-200 rounded-lg font-medium text-teal-600 text-sm"
                  />
                  <button
                    onClick={copyToClipboard}
                    className="px-4 py-2.5 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 active:scale-[0.98] flex items-center gap-2 text-sm"
                  >
                    {copied ? (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Copied
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Copy
                      </>
                    )}
                  </button>
                </div>
                {result.expires_at && (
                  <p className="mt-3 text-sm text-slate-500 flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Expires {new Date(result.expires_at).toLocaleDateString()}
                  </p>
                )}
                {!user && (
                  <p className="mt-3 text-sm text-slate-500">
                    <Link to="/register" className="text-teal-600 hover:text-teal-700 font-medium">Create an account</Link>
                    {' '}to track clicks and manage links
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Features */}
          <div className="mt-16 grid grid-cols-3 gap-8 text-center">
            <div>
              <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="font-medium text-slate-900 text-sm">Instant</h3>
              <p className="text-xs text-slate-500 mt-1">Links in milliseconds</p>
            </div>
            <div>
              <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="font-medium text-slate-900 text-sm">Analytics</h3>
              <p className="text-xs text-slate-500 mt-1">Track every click</p>
            </div>
            <div>
              <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
              </div>
              <h3 className="font-medium text-slate-900 text-sm">QR Codes</h3>
              <p className="text-xs text-slate-500 mt-1">Generate instantly</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
