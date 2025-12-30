import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { getUrl, getStats, getDaily, getGeoStats } from '../api';

export default function Stats() {
  const { shortCode } = useParams();
  const [urlInfo, setUrlInfo] = useState(null);
  const [stats, setStats] = useState(null);
  const [dailyData, setDailyData] = useState([]);
  const [geoData, setGeoData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [urlRes, statsRes, dailyRes, geoRes] = await Promise.all([
          getUrl(shortCode),
          getStats(shortCode),
          getDaily(shortCode, 30),
          getGeoStats(shortCode).catch(() => ({ data: null })),
        ]);
        setUrlInfo(urlRes.data);
        setStats(statsRes.data);
        setDailyData(dailyRes.data.data);
        setGeoData(geoRes.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [shortCode]);

  const getShortUrl = () => `${window.location.origin}/s/${shortCode}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(getShortUrl());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-slate-200 border-t-teal-600 rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-slate-600 text-sm">Loading statistics...</p>
        </div>
      </div>
    );
  }

  if (!urlInfo) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center bg-white rounded-xl border border-slate-200 p-10 max-w-sm">
          <div className="w-12 h-12 bg-red-50 rounded-lg flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">URL not found</h1>
          <p className="text-slate-500 text-sm mb-6">This link doesn't exist or has been deleted.</p>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 active:scale-[0.98] text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Dashboard
          </Link>
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
          <Link
            to="/dashboard"
            className="flex items-center gap-2 text-slate-600 hover:text-slate-900 font-medium text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Dashboard
          </Link>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">/{shortCode}</h1>
                <button
                  onClick={copyToClipboard}
                  className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded"
                  title="Copy short URL"
                >
                  {copied ? (
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
              <a
                href={urlInfo.original_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-500 text-sm hover:text-teal-600 truncate block max-w-lg"
              >
                {urlInfo.original_url}
              </a>
            </div>
            <div className="flex items-center gap-3">
              {urlInfo.expires_at && (
                <span className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-medium ${
                  new Date(urlInfo.expires_at) < new Date()
                    ? 'bg-red-50 text-red-700'
                    : 'bg-amber-50 text-amber-700'
                }`}>
                  {new Date(urlInfo.expires_at) < new Date() ? 'Expired' : `Expires ${new Date(urlInfo.expires_at).toLocaleDateString()}`}
                </span>
              )}
              <a
                href={`/api/urls/${shortCode}/qr`}
                download={`qr-${shortCode}.png`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200 text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
                Download QR
              </a>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Total Clicks</p>
            <p className="text-2xl font-bold text-slate-900">{stats?.totalClicks || 0}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Last 24 Hours</p>
            <p className="text-2xl font-bold text-teal-600">{stats?.last24Hours || 0}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Last 7 Days</p>
            <p className="text-2xl font-bold text-slate-900">{stats?.last7Days || 0}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Created</p>
            <p className="text-lg font-bold text-slate-900">
              {new Date(urlInfo.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Click Chart - Larger */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-sm font-medium text-slate-900 uppercase tracking-wider mb-4">Clicks Over Time</h2>
            {dailyData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-slate-500">
                <div className="text-center">
                  <svg className="w-10 h-10 text-slate-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <p className="text-sm">No click data yet</p>
                  <p className="text-xs text-slate-400 mt-1">Data appears when people click</p>
                </div>
              </div>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dailyData}>
                    <defs>
                      <linearGradient id="colorClicks" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0d9488" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#0d9488" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                        fontSize: '13px',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="clicks"
                      stroke="#0d9488"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorClicks)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Geographic Data */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-sm font-medium text-slate-900 uppercase tracking-wider mb-4">Top Countries</h2>
            {!geoData || geoData.countries?.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-slate-500">
                <div className="text-center">
                  <svg className="w-10 h-10 text-slate-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm">No location data yet</p>
                  <p className="text-xs text-slate-400 mt-1">Geographic data appears as clicks come in</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {geoData.countries.slice(0, 5).map((country, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="text-base">{getCountryFlag(country.countryCode)}</span>
                      <span className="text-slate-700 text-sm font-medium">{country.country}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-teal-500 rounded-full"
                          style={{ width: `${(country.clicks / geoData.totalClicks) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-500 w-8 text-right">{country.clicks}</span>
                    </div>
                  </div>
                ))}
                {geoData.totalWithLocation < geoData.totalClicks && (
                  <p className="text-xs text-slate-400 pt-2 border-t border-slate-100">
                    {geoData.totalClicks - geoData.totalWithLocation} clicks from unknown locations
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

// Helper function to get country flag emoji
function getCountryFlag(countryCode) {
  if (!countryCode) return '';
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}
