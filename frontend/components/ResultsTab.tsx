import React, { useState, useEffect, useCallback } from 'react';
import { STallBusinessProfile, GBPPerformanceData, GBPDailyMetricPoint } from '../types';
import { GoogleBusinessService } from '../services/googleBusinessService';
import { 
  Phone, 
  Globe, 
  Navigation, 
  Eye, 
  MessageSquare, 
  TrendingUp, 
  RefreshCw, 
  AlertCircle, 
  Calendar,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';

interface ResultsTabProps {
  profile: STallBusinessProfile;
}

export const ResultsTab: React.FC<ResultsTabProps> = ({ profile }) => {
  const [selectedRange, setSelectedRange] = useState<1 | 7 | 30>(30);
  const [performanceData, setPerformanceData] = useState<GBPPerformanceData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chartMetric, setChartMetric] = useState<'impressions' | 'actions'>('impressions');

  // Fetch real Google Performance metrics
  const fetchPerformance = useCallback(async (days: 1 | 7 | 30) => {
    // If in preview sandbox session without live token, keep empty state without fake numbers
    if (profile.isPreviewDevSession) {
      setPerformanceData(null);
      return;
    }

    const token = GoogleBusinessService.getStoredAccessToken();
    if (!token) {
      setError('Active Google OAuth access token required to fetch Performance metrics.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await GoogleBusinessService.fetchPerformanceMetrics(
        profile.locationResourceName,
        days,
        token
      );
      setPerformanceData(data);
    } catch (err: unknown) {
      console.error('[STall GBP] Failed to fetch Performance API metrics:', err);
      setError(err instanceof Error ? err.message : 'Google Performance API returned an error.');
      setPerformanceData(null);
    } finally {
      setLoading(false);
    }
  }, [profile.locationResourceName, profile.isPreviewDevSession]);

  useEffect(() => {
    fetchPerformance(selectedRange);
  }, [selectedRange, fetchPerformance]);

  // Format date range string for UI
  const formatPeriodLabel = () => {
    if (!performanceData) {
      return `Last ${selectedRange} day${selectedRange > 1 ? 's' : ''}`;
    }
    const { startDate, endDate } = performanceData.period;
    return `${startDate.year}-${String(startDate.month).padStart(2, '0')}-${String(startDate.day).padStart(2, '0')} to ${endDate.year}-${String(endDate.month).padStart(2, '0')}-${String(endDate.day).padStart(2, '0')} (${selectedRange} days)`;
  };

  const metrics = performanceData?.metrics;

  return (
    <div className="space-y-8">
      {/* Header & Source Integrity Notice */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900 border border-slate-800">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-base font-bold text-white">Google Performance Analytics</h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
              Read-Only Performance API
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Official metrics retrieved directly from Google Business Profile Performance API for location: <code className="text-slate-300 font-mono">{profile.locationResourceName}</code>.
          </p>
        </div>

        {/* Range Selector: 1 day, 7 days, 30 days */}
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setSelectedRange(1)}
              disabled={loading}
              className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                selectedRange === 1 ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              1 Day
            </button>
            <button
              onClick={() => setSelectedRange(7)}
              disabled={loading}
              className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                selectedRange === 7 ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              7 Days
            </button>
            <button
              onClick={() => setSelectedRange(30)}
              disabled={loading}
              className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                selectedRange === 30 ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              30 Days
            </button>
          </div>

          <button
            onClick={() => fetchPerformance(selectedRange)}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition disabled:opacity-50"
            title="Refresh Performance API metrics"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-300 text-xs flex items-start space-x-2.5">
          <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 leading-relaxed">
            <span className="font-semibold block mb-0.5">Google Business Profile Performance API Notice:</span>
            {error}
            <span className="block mt-1 text-[11px] text-rose-400/80">
              Note: The Google Performance API requires historical metrics to be recorded by Google and may have a standard 2 to 3 day reporting latency.
            </span>
          </div>
        </div>
      )}

      {/* Period Banner */}
      <div className="flex items-center justify-between text-xs px-2">
        <span className="text-slate-400 flex items-center space-x-1.5">
          <Calendar className="w-3.5 h-3.5 text-blue-400" />
          <span>Period: <strong className="text-slate-200">{formatPeriodLabel()}</strong></span>
        </span>
        <span className="text-slate-500 text-[11px]">
          Source: Google Business Profile Performance API
        </span>
      </div>

      {/* Real Google Performance Metric Cards (Strictly real or 'Not available from Google') */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Maps Impressions */}
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Maps Impressions</span>
            <Eye className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <div className="text-2xl font-black text-white">
              {metrics && metrics.mapsImpressions !== null ? (
                metrics.mapsImpressions.toLocaleString()
              ) : (
                <span className="text-sm font-normal text-slate-500 italic">Not available from Google</span>
              )}
            </div>
            {metrics && (metrics.desktopMapsImpressions !== null || metrics.mobileMapsImpressions !== null) && (
              <div className="text-[10px] text-slate-500 font-mono mt-1 space-x-2">
                {metrics.mobileMapsImpressions !== null && <span>Mobile: {metrics.mobileMapsImpressions}</span>}
                {metrics.desktopMapsImpressions !== null && <span>Desktop: {metrics.desktopMapsImpressions}</span>}
              </div>
            )}
          </div>
          <div className="pt-2 border-t border-slate-800/80 text-[10px] text-slate-500 flex items-center justify-between">
            <span>Source: Google Business Profile</span>
            <span className="font-mono">BUSINESS_IMPRESSIONS_*_MAPS</span>
          </div>
        </div>

        {/* Search Impressions */}
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Search Impressions</span>
            <Eye className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <div className="text-2xl font-black text-white">
              {metrics && metrics.searchImpressions !== null ? (
                metrics.searchImpressions.toLocaleString()
              ) : (
                <span className="text-sm font-normal text-slate-500 italic">Not available from Google</span>
              )}
            </div>
            {metrics && (metrics.desktopSearchImpressions !== null || metrics.mobileSearchImpressions !== null) && (
              <div className="text-[10px] text-slate-500 font-mono mt-1 space-x-2">
                {metrics.mobileSearchImpressions !== null && <span>Mobile: {metrics.mobileSearchImpressions}</span>}
                {metrics.desktopSearchImpressions !== null && <span>Desktop: {metrics.desktopSearchImpressions}</span>}
              </div>
            )}
          </div>
          <div className="pt-2 border-t border-slate-800/80 text-[10px] text-slate-500 flex items-center justify-between">
            <span>Source: Google Business Profile</span>
            <span className="font-mono">BUSINESS_IMPRESSIONS_*_SEARCH</span>
          </div>
        </div>

        {/* Click-to-Call */}
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Call Clicks</span>
            <Phone className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <div className="text-2xl font-black text-white">
              {metrics && metrics.calls !== null ? (
                metrics.calls.toLocaleString()
              ) : (
                <span className="text-sm font-normal text-slate-500 italic">Not available from Google</span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Direct phone clicks on Google Search & Maps
            </p>
          </div>
          <div className="pt-2 border-t border-slate-800/80 text-[10px] text-slate-500 flex items-center justify-between">
            <span>Source: Google Business Profile</span>
            <span className="font-mono">BUSINESS_CALLS</span>
          </div>
        </div>

        {/* Direction Requests */}
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Direction Requests</span>
            <Navigation className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <div className="text-2xl font-black text-white">
              {metrics && metrics.directions !== null ? (
                metrics.directions.toLocaleString()
              ) : (
                <span className="text-sm font-normal text-slate-500 italic">Not available from Google</span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Google Maps route queries to this storefront
            </p>
          </div>
          <div className="pt-2 border-t border-slate-800/80 text-[10px] text-slate-500 flex items-center justify-between">
            <span>Source: Google Business Profile</span>
            <span className="font-mono">BUSINESS_DIRECTION_REQUESTS</span>
          </div>
        </div>

        {/* Website Clicks */}
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Website Clicks</span>
            <Globe className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <div className="text-2xl font-black text-white">
              {metrics && metrics.websiteClicks !== null ? (
                metrics.websiteClicks.toLocaleString()
              ) : (
                <span className="text-sm font-normal text-slate-500 italic">Not available from Google</span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Visits to official URL from Google Profile
            </p>
          </div>
          <div className="pt-2 border-t border-slate-800/80 text-[10px] text-slate-500 flex items-center justify-between">
            <span>Source: Google Business Profile</span>
            <span className="font-mono">BUSINESS_WEBSITE_CLICKS</span>
          </div>
        </div>

        {/* Conversations / Messages */}
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Conversations</span>
            <MessageSquare className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <div className="text-2xl font-black text-white">
              {metrics && metrics.conversations !== null ? (
                metrics.conversations.toLocaleString()
              ) : (
                <span className="text-sm font-normal text-slate-500 italic">Not available from Google</span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Direct chat inquiries on Google Maps
            </p>
          </div>
          <div className="pt-2 border-t border-slate-800/80 text-[10px] text-slate-500 flex items-center justify-between">
            <span>Source: Google Business Profile</span>
            <span className="font-mono">BUSINESS_CONVERSATIONS</span>
          </div>
        </div>
      </div>

      {/* Real Daily Time Series Chart (Rendered only when real Google daily points exist) */}
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-4 h-4 text-blue-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Google Daily Time Series (Source: Google Business Profile)
            </h3>
          </div>
          <div className="flex items-center space-x-1.5 text-xs bg-slate-950 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => setChartMetric('impressions')}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition ${
                chartMetric === 'impressions' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Impressions
            </button>
            <button
              onClick={() => setChartMetric('actions')}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition ${
                chartMetric === 'actions' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Actions (Calls/Directions/Web)
            </button>
          </div>
        </div>

        {loading ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-xs space-y-2">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-400" />
            <span>Fetching real time series from Google Performance API...</span>
          </div>
        ) : performanceData && performanceData.daily.length > 0 ? (
          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={performanceData.daily} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorMaps" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorSearch" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="dateStr" stroke="#64748b" fontSize={10} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '11px' }}
                  labelStyle={{ color: '#94a3b8', fontWeight: 'bold' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                {chartMetric === 'impressions' ? (
                  <>
                    <Area type="monotone" dataKey="mapsImpressions" name="Maps Impressions" stroke="#3b82f6" fillOpacity={1} fill="url(#colorMaps)" strokeWidth={2} />
                    <Area type="monotone" dataKey="searchImpressions" name="Search Impressions" stroke="#10b981" fillOpacity={1} fill="url(#colorSearch)" strokeWidth={2} />
                  </>
                ) : (
                  <>
                    <Area type="monotone" dataKey="calls" name="Calls" stroke="#f59e0b" fillOpacity={0.3} fill="#f59e0b" strokeWidth={2} />
                    <Area type="monotone" dataKey="directions" name="Directions" stroke="#ec4899" fillOpacity={0.3} fill="#ec4899" strokeWidth={2} />
                    <Area type="monotone" dataKey="websiteClicks" name="Website Clicks" stroke="#8b5cf6" fillOpacity={0.3} fill="#8b5cf6" strokeWidth={2} />
                  </>
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="py-12 border border-dashed border-slate-800 rounded-xl text-center space-y-1">
            <p className="text-sm font-semibold text-slate-300">No time series data returned by Google</p>
            <p className="text-xs text-slate-500">
              {error
                ? 'Google Performance API did not return historical metrics for this period.'
                : 'Performance data has not yet been populated by Google for this location range.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
