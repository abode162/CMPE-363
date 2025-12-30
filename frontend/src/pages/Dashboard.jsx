import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getUrls, createUrl, getStats } from '../api';
import { useAuth } from '../context/AuthContext';

// QR Code Modal Component
function QRModal({ shortCode, shortUrl, onClose }) {
  const [loading, setLoading] = useState(true);
  const qrUrl = `/api/urls/${shortCode}/qr`;

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl border border-slate-200 max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-slate-900">QR Code</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded-lg">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex flex-col items-center">
          <div className="bg-white p-4 rounded-lg border border-slate-200 mb-4">
            {loading && (
              <div className="w-48 h-48 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-slate-200 border-t-teal-600 rounded-full animate-spin"></div>
              </div>
            )}
            <img
              src={qrUrl}
              alt="QR Code"
              className={`w-48 h-48 ${loading ? 'hidden' : 'block'}`}
              onLoad={() => setLoading(false)}
              onError={() => setLoading(false)}
            />
          </div>
          <p className="text-sm text-slate-500 text-center mb-4 break-all">{shortUrl}</p>
          <a
            href={qrUrl}
            download={`qr-${shortCode}.png`}
            className="w-full py-2.5 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 active:scale-[0.98] text-center text-sm"
          >
            Download QR Code
          </a>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [urls, setUrls] = useState([]);
  const [urlStats, setUrlStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [url, setUrl] = useState('');
  const [customCode, setCustomCode] = useState('');
  const [expiresInDays, setExpiresInDays] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(null);
  const [qrModal, setQrModal] = useState(null);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    fetchUrls();
  }, [user, navigate]);

  const fetchUrls = async () => {
    try {
      const res = await getUrls();
      const urlList = res.data || [];
      setUrls(urlList);

      // Fetch stats for each URL
      const statsPromises = urlList.map(async (item) => {
        try {
          const statsRes = await getStats(item.short_code);
          return { shortCode: item.short_code, stats: statsRes.data };
        } catch {
          return { shortCode: item.short_code, stats: { totalClicks: 0 } };
        }
      });

      const statsResults = await Promise.all(statsPromises);
      const statsMap = {};
      statsResults.forEach(({ shortCode, stats }) => {
        statsMap[shortCode] = stats;
      });
      setUrlStats(statsMap);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    setCreating(true);
    try {
      const data = { original_url: url };
      if (customCode.trim()) data.custom_code = customCode.trim();
      if (expiresInDays) data.expires_in_days = parseInt(expiresInDays);
      await createUrl(data);
      setUrl('');
      setCustomCode('');
      setExpiresInDays('');
      fetchUrls();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create URL');
    } finally {
      setCreating(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const getShortUrl = (shortCode) => {
    return `${window.location.origin}/s/${shortCode}`;
  };

  const copyToClipboard = (shortCode) => {
    navigator.clipboard.writeText(getShortUrl(shortCode));
    setCopied(shortCode);
    setTimeout(() => setCopied(null), 2000);
  };

  const isExpired = (expiresAt) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-slate-200 border-t-teal-600 rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-slate-600 text-sm">Loading your URLs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navigation */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link to="/" className="text-xl font-semibold text-slate-900 tracking-tight">
            Shortify
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2.5 pr-3 border-r border-slate-200">
              <div className="w-8 h-8 bg-teal-600 rounded-full flex items-center justify-center text-white font-medium text-sm">
                {user?.name?.charAt(0).toUpperCase()}
              </div>
              <span className="text-slate-700 font-medium text-sm hidden sm:block">{user?.name}</span>
            </div>
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium"
            >
              Sign out
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Dashboard</h1>
          <p className="text-slate-600 mt-1">Manage and track your shortened URLs</p>
        </div>

        {/* Create URL Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-8">
          <h2 className="text-sm font-medium text-slate-900 uppercase tracking-wider mb-4">Create New Link</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">URL to shorten</label>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com/your-long-url"
                  required
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Custom code</label>
                <input
                  type="text"
                  value={customCode}
                  onChange={(e) => setCustomCode(e.target.value)}
                  placeholder="my-link (optional)"
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-4 items-end">
              <div className="w-44">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Expiration</label>
                <select
                  value={expiresInDays}
                  onChange={(e) => setExpiresInDays(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
                >
                  <option value="">Never</option>
                  <option value="1">1 day</option>
                  <option value="7">7 days</option>
                  <option value="30">30 days</option>
                  <option value="90">90 days</option>
                  <option value="365">1 year</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={creating}
                className="px-6 py-2.5 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 active:scale-[0.98] disabled:opacity-50 text-sm"
              >
                {creating ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Creating...
                  </span>
                ) : 'Create Link'}
              </button>
            </div>
          </form>
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-100 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}
        </div>

        {/* URLs Table */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
            <h2 className="text-sm font-medium text-slate-900 uppercase tracking-wider">Your Links</h2>
            <span className="text-sm text-slate-500">
              {urls.length} {urls.length === 1 ? 'link' : 'links'}
            </span>
          </div>

          {urls.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              </div>
              <h3 className="font-medium text-slate-900 mb-1">No links yet</h3>
              <p className="text-slate-500 text-sm">Create your first short link above</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Link</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Destination</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Clicks</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {urls.map((item) => {
                    const shortUrl = getShortUrl(item.short_code);
                    const stats = urlStats[item.short_code] || {};
                    const expired = isExpired(item.expires_at);

                    return (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <a
                              href={shortUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-teal-600 hover:text-teal-700 font-medium text-sm"
                            >
                              /s/{item.short_code}
                            </a>
                            <button
                              onClick={() => copyToClipboard(item.short_code)}
                              className="p-1 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded"
                              title="Copy URL"
                            >
                              {copied === item.short_code ? (
                                <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                              )}
                            </button>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-slate-600 truncate max-w-xs text-sm" title={item.original_url}>
                            {item.original_url}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-slate-900 font-medium text-sm">
                            {stats.totalClicks || 0}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {expired ? (
                            <span className="inline-flex items-center px-2 py-0.5 bg-red-50 text-red-700 rounded text-xs font-medium">
                              Expired
                            </span>
                          ) : item.expires_at ? (
                            <span className="inline-flex items-center px-2 py-0.5 bg-amber-50 text-amber-700 rounded text-xs font-medium">
                              Expires {new Date(item.expires_at).toLocaleDateString()}
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded text-xs font-medium">
                              Active
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1">
                            <Link
                              to={`/stats/${item.short_code}`}
                              className="p-1.5 text-slate-500 hover:text-teal-600 hover:bg-teal-50 rounded"
                              title="View Stats"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                              </svg>
                            </Link>
                            <button
                              onClick={() => setQrModal({ shortCode: item.short_code, shortUrl })}
                              className="p-1.5 text-slate-500 hover:text-teal-600 hover:bg-teal-50 rounded"
                              title="Show QR Code"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* QR Code Modal */}
      {qrModal && (
        <QRModal
          shortCode={qrModal.shortCode}
          shortUrl={qrModal.shortUrl}
          onClose={() => setQrModal(null)}
        />
      )}
    </div>
  );
}
