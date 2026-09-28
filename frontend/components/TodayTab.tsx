import React, { useState } from 'react';
import { STallBusinessProfile, GrowthAction } from '../types';
import { GoogleBusinessService } from '../services/googleBusinessService';
import { 
  Check, 
  X, 
  Clock, 
  Sparkles, 
  Eye, 
  ShieldCheck, 
  CheckCircle2, 
  RotateCcw, 
  ArrowUpRight,
  Zap,
  CheckCheck,
  Layers,
  HelpCircle
} from 'lucide-react';

interface TodayTabProps {
  profile: STallBusinessProfile;
  onUpdateProfile: (updated: STallBusinessProfile) => void;
  onNavigateToGrowth?: () => void;
}

export const TodayTab: React.FC<TodayTabProps> = ({ profile, onUpdateProfile, onNavigateToGrowth }) => {
  const scoreBreakdown = GoogleBusinessService.calculateDigitalScore(profile);
  const [selectedAction, setSelectedAction] = useState<GrowthAction | null>(null);
  const [showScoreBreakdown, setShowScoreBreakdown] = useState(false);
  const [isBulkExecuting, setIsBulkExecuting] = useState(false);

  const [actions, setActions] = useState<GrowthAction[]>(() => {
    const list: GrowthAction[] = [];

    if (!profile.phone || profile.phone === 'None specified' || profile.phone.trim() === '') {
      list.push({
        id: 'action-phone',
        title: 'Add Primary Business Telephone to Google Profile',
        category: 'PROFILE_OPTIMIZATION',
        impactScore: 4,
        effortMinutes: 1,
        description: 'Publish a direct phone number on Google Business Profile to complete contact channel readiness.',
        technicalDetails: 'Updates phoneNumbers.primaryPhone via GBP Business Information API v1 patch mask.',
        status: 'PENDING',
      });
    }

    if (!profile.website || profile.website.trim() === '') {
      list.push({
        id: 'action-web',
        title: 'Connect Verified Domain to Google Business',
        category: 'PROFILE_OPTIMIZATION',
        impactScore: 4,
        effortMinutes: 2,
        description: 'Link your official website URL to provide searchers with a direct destination.',
        technicalDetails: 'Updates websiteUri parameter on Google location record.',
        status: 'PENDING',
      });
    }

    if (profile.additionalCategories.length === 0) {
      list.push({
        id: 'action-categories',
        title: 'Expand Google Secondary Categories',
        category: 'SERVICES_EXPANSION',
        impactScore: 4,
        effortMinutes: 2,
        description: `Your primary category is "${profile.primaryCategory || 'General'}". Adding secondary categories broadens listing taxonomy.`,
        technicalDetails: 'Appends complementary categories to categories.additionalCategories array.',
        status: 'PENDING',
      });
    }

    list.push({
      id: 'action-hours-check',
      title: 'Verify Holiday & Regular Hours Precision',
      category: 'HOURS_UPDATE',
      impactScore: 2,
      effortMinutes: 1,
      description: 'Ensure regular and special operating schedules are fully documented.',
      technicalDetails: 'Audits regularHours.periods against specialHours schedules.',
      status: 'PENDING',
    });

    list.push({
      id: 'action-weekly-photo',
      title: 'Review Google Service Items Catalog',
      category: 'PHOTO_ASSET',
      impactScore: 4,
      effortMinutes: 3,
      description: 'Ensure itemized services reflect current offerings on your Google location.',
      technicalDetails: 'Audits location.serviceItems via GBP Business Information API.',
      status: 'PENDING',
    });

    return list;
  });

  const [executingId, setExecutingId] = useState<string | null>(null);

  const handleAction = (id: string, status: 'APPROVED' | 'REJECTED') => {
    if (status === 'APPROVED') {
      setExecutingId(id);
      setTimeout(() => {
        setActions((prev) =>
          prev.map((a) =>
            a.id === id ? { ...a, status: 'EXECUTED', executedAt: new Date().toLocaleTimeString() } : a
          )
        );
        setExecutingId(null);
      }, 500);
    } else {
      setActions((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: 'REJECTED' } : a))
      );
    }
  };

  const handleApproveAll = () => {
    setIsBulkExecuting(true);
    setTimeout(() => {
      setActions((prev) =>
        prev.map((a) =>
          a.status === 'PENDING'
            ? { ...a, status: 'EXECUTED', executedAt: new Date().toLocaleTimeString() }
            : a
        )
      );
      setIsBulkExecuting(false);
    }, 600);
  };

  const handleResetAction = (id: string) => {
    setActions((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: 'PENDING', executedAt: undefined } : a))
    );
  };

  const pendingCount = actions.filter((a) => a.status === 'PENDING').length;
  const executedCount = actions.filter((a) => a.status === 'EXECUTED').length;
  const visibleScore = scoreBreakdown.totalScore;

  return (
    <div className="space-y-8">
      {/* Top Banner: Digital Score & Today's Executive Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Digital Score Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Digital Score
              </span>
              <button
                onClick={() => setShowScoreBreakdown(!showScoreBreakdown)}
                className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 font-mono transition flex items-center space-x-1"
                title="View STall Measurement Framework Audit"
              >
                <span>Audit Spec</span>
                <HelpCircle className="w-3 h-3" />
              </button>
            </div>

            <div className="flex items-baseline space-x-2">
              <span className="text-5xl font-black text-white tracking-tight">
                {visibleScore !== null ? visibleScore : '—'}
              </span>
              <span className="text-xl text-slate-500 font-bold">/ 100</span>
              <span className="text-[11px] text-slate-400 font-mono">
                ({scoreBreakdown.earnedAssessablePoints.toFixed(1)} / {scoreBreakdown.maxAssessablePoints} pts)
              </span>
            </div>

            <div className="w-full bg-slate-800 rounded-full h-2.5 my-4 overflow-hidden">
              <div
                className={`h-2.5 rounded-full transition-all duration-700 ${
                  (visibleScore || 0) >= 80
                    ? 'bg-emerald-500'
                    : (visibleScore || 0) >= 50
                    ? 'bg-amber-500'
                    : 'bg-rose-500'
                }`}
                style={{ width: `${visibleScore || 0}%` }}
              ></div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs pt-3 border-t border-slate-800/80">
            <div>
              <span className="text-slate-500 block">Profile Readiness:</span>
              <strong className="text-slate-200 font-mono">{scoreBreakdown.profileReadinessScore}/54 pts</strong>
            </div>
            <div>
              <span className="text-slate-500 block">Customer Engagement:</span>
              <strong className="text-slate-200 font-mono">{scoreBreakdown.customerEngagementScore} pts</strong>
            </div>
            <div>
              <span className="text-slate-500 block">Google Performance:</span>
              <strong className="text-slate-200 font-mono">{scoreBreakdown.googlePerformanceScore} pts</strong>
            </div>
            <div>
              <span className="text-slate-500 block">STall Conversions:</span>
              <strong className="text-slate-200 font-mono">{scoreBreakdown.stallConversionsScore} pts</strong>
            </div>
          </div>
        </div>

        {/* Today's Growth Plan Overview */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">Today's Growth Plan</h3>
              </div>
              <div className="flex items-center space-x-2">
                <span className="flex items-center space-x-1.5 text-xs text-slate-400 font-medium">
                  <Clock className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Target Review: ~2-5 min/day</span>
                </span>
                {pendingCount > 0 && (
                  <button
                    onClick={handleApproveAll}
                    disabled={isBulkExecuting}
                    className="px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg text-xs flex items-center space-x-1 shadow-sm transition disabled:opacity-50"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span>{isBulkExecuting ? 'Executing...' : 'Approve All Pending'}</span>
                  </button>
                )}
              </div>
            </div>
            <p className="text-slate-400 text-xs leading-relaxed">
              Review and approve daily high-impact recommendations calibrated specifically against your Google Business Profile data for <strong className="text-white">{profile.title}</strong>.
            </p>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 p-4 bg-slate-950/60 rounded-xl border border-slate-800">
            <div className="flex items-center space-x-4">
              <div>
                <div className="text-xs text-slate-500 uppercase font-semibold">Pending Approvals</div>
                <div className="text-xl font-bold text-emerald-400">{pendingCount} actions</div>
              </div>
              <div className="h-8 w-px bg-slate-800"></div>
              <div>
                <div className="text-xs text-slate-500 uppercase font-semibold">Executed Today</div>
                <div className="text-xl font-bold text-slate-200">{executedCount} done</div>
              </div>
              <div className="h-8 w-px bg-slate-800"></div>
              <div>
                <div className="text-xs text-slate-500 uppercase font-semibold">Google Status</div>
                <div className="text-xs text-slate-300 flex items-center space-x-1 font-medium mt-1">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>{profile.hasVoiceOfMerchant ? 'Verified Merchant' : 'Review Profile'}</span>
                </div>
              </div>
            </div>

            {onNavigateToGrowth && (
              <button
                onClick={onNavigateToGrowth}
                className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center space-x-1"
              >
                <span>Open Growth Engine Loop</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Digital Score Component Audit Modal */}
      {showScoreBreakdown && (
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <Layers className="w-4 h-4 text-emerald-400" />
                <span>STall Measurement Framework — 14 Component Audit</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Dynamic normalization applied: Not Assessable components contribute 0 to numerator and denominator.
              </p>
            </div>
            <button
              onClick={() => setShowScoreBreakdown(false)}
              className="text-xs text-slate-400 hover:text-white"
            >
              ✕ Close
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            {scoreBreakdown.components.map((c) => (
              <div
                key={c.code}
                className={`p-3 rounded-xl border flex flex-col justify-between space-y-1.5 ${
                  !c.isAssessable
                    ? 'bg-slate-950/40 border-slate-800/60 opacity-60'
                    : c.earnedPoints === c.maxPoints
                    ? 'bg-emerald-950/20 border-emerald-500/30'
                    : 'bg-slate-950 border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5">
                    <span className="font-mono text-emerald-400 font-bold">{c.code}</span>
                    <span className="font-semibold text-white">{c.name}</span>
                  </div>
                  <span className="font-mono text-xs">
                    {c.isAssessable ? (
                      <strong className="text-slate-200">{c.earnedPoints.toFixed(1)} / {c.maxPoints} pts</strong>
                    ) : (
                      <span className="text-slate-500 italic">Not Assessable</span>
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>{c.pillar}</span>
                  <span className="font-mono text-[10px] text-slate-500 truncate max-w-[220px]">{c.statusNote}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Items List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
            Daily Execution Queue
          </h3>
          <span className="text-xs text-slate-500 font-medium">
            Owner Approvals Only
          </span>
        </div>

        <div className="space-y-3">
          {actions.map((action) => (
            <div
              key={action.id}
              className={`p-5 rounded-2xl border transition-all ${
                action.status === 'EXECUTED'
                  ? 'bg-emerald-950/20 border-emerald-500/30'
                  : action.status === 'REJECTED'
                  ? 'bg-slate-950/30 border-slate-800/40 opacity-50'
                  : 'bg-slate-900 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center space-x-2.5">
                    <span className="text-sm font-semibold text-white">
                      {action.title}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                      +{action.impactScore} pts
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                      ~{action.effortMinutes}m
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed max-w-2xl">
                    {action.description}
                  </p>
                </div>

                {/* Status, Preview, & Approve/Reject Controls */}
                <div className="flex items-center space-x-2 self-end sm:self-center">
                  <button
                    onClick={() => setSelectedAction(action)}
                    className="p-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs transition"
                    title="View Action Preview & Technical Details"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>

                  {action.status === 'PENDING' && (
                    <>
                      <button
                        onClick={() => handleAction(action.id, 'REJECTED')}
                        className="px-3 py-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs font-medium flex items-center space-x-1"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Reject</span>
                      </button>
                      <button
                        onClick={() => handleAction(action.id, 'APPROVED')}
                        disabled={executingId === action.id}
                        className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center space-x-1.5 shadow-md shadow-emerald-500/20"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>{executingId === action.id ? 'Executing...' : 'Approve'}</span>
                      </button>
                    </>
                  )}

                  {action.status === 'EXECUTED' && (
                    <div className="flex items-center space-x-2">
                      <div className="flex items-center space-x-1 text-xs text-emerald-400 font-semibold px-3 py-1 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Executed {action.executedAt ? `@ ${action.executedAt}` : ''}</span>
                      </div>
                      <button
                        onClick={() => handleResetAction(action.id)}
                        className="p-1 text-slate-500 hover:text-slate-300"
                        title="Re-queue action"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {action.status === 'REJECTED' && (
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-slate-500 italic">Dismissed for today</span>
                      <button
                        onClick={() => handleResetAction(action.id)}
                        className="p-1 text-slate-500 hover:text-slate-300"
                        title="Re-queue action"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Action Preview Modal */}
      {selectedAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <span className="text-xs font-mono text-emerald-400 uppercase tracking-wider">
                Action Preview & Execution Details
              </span>
              <button
                onClick={() => setSelectedAction(null)}
                className="text-slate-400 hover:text-white text-xs"
              >
                ✕ Close
              </button>
            </div>

            <div className="space-y-3">
              <h4 className="text-base font-bold text-white">{selectedAction.title}</h4>
              <p className="text-xs text-slate-300 leading-relaxed">{selectedAction.description}</p>

              {selectedAction.technicalDetails && (
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 font-mono text-[11px] text-slate-400">
                  <div className="text-slate-500 uppercase text-[10px] mb-1 font-sans font-bold">API Execution Spec</div>
                  {selectedAction.technicalDetails}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
                <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                  <span className="text-slate-500 block">Digital Score Lift</span>
                  <strong className="text-emerald-400">+{actionImpact(selectedAction.impactScore)} Points</strong>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                  <span className="text-slate-500 block">Estimated Review Time</span>
                  <strong className="text-slate-300">~{selectedAction.effortMinutes} Minutes</strong>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedAction(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function actionImpact(pts: number): number {
  return pts;
}
