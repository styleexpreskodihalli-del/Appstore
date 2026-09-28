import React, { useState } from 'react';
import { STallBusinessProfile } from '../types';
import { GoogleBusinessService } from '../services/googleBusinessService';
import { Cpu, Play, CheckCircle2, RotateCw, Activity, ShieldCheck, ArrowRight, Zap, RefreshCw } from 'lucide-react';

interface GrowthEngineTabProps {
  profile: STallBusinessProfile;
  onRefreshScore?: () => void;
}

export const GrowthEngineTab: React.FC<GrowthEngineTabProps> = ({ profile, onRefreshScore }) => {
  const [currentStep, setCurrentStep] = useState<number>(3); // Step 3: Owner Approves
  const [isProcessing, setIsProcessing] = useState(false);
  const baseScore = GoogleBusinessService.calculateDigitalScore(profile);
  const [scoreLift, setScoreLift] = useState(0);

  const [log, setLog] = useState<string[]>([
    `[${new Date().toLocaleTimeString()}] Authenticated with Google Account: ${profile.accountName}`,
    `[${new Date().toLocaleTimeString()}] Ingested location: ${profile.title} (${profile.locationResourceName})`,
    `[${new Date().toLocaleTimeString()}] Google Voice of Merchant status: ${profile.hasVoiceOfMerchant ? 'Verified' : 'Pending Verification'}`,
    `[${new Date().toLocaleTimeString()}] Digital Score baseline computed: ${baseScore.totalScore}/100`,
    `[${new Date().toLocaleTimeString()}] Daily Growth Engine standing by for owner approvals (2-5 min/day).`
  ]);

  const steps = [
    { num: 1, title: 'Analyze', desc: 'Audit GBP completeness, pin marker accuracy & local search signals' },
    { num: 2, title: 'Generate Plan', desc: 'Formulate daily high-ROI actions calibrated to current GBP state' },
    { num: 3, title: 'Owner Approves', desc: 'Owner reviews & approves recommended growth actions (2-5 min)' },
    { num: 4, title: 'STall Executes', desc: 'Automate GBP patch updates, hours sync, and offer publication' },
    { num: 5, title: 'Measure & Score', desc: 'Recalculate Digital Score and prepare next 24hr growth plan' },
  ];

  const runFullCycle = () => {
    setIsProcessing(true);
    let step = 1;
    setCurrentStep(1);

    const interval = setInterval(() => {
      step += 1;
      if (step <= 5) {
        setCurrentStep(step);
        setLog((prev) => [
          ...prev,
          `[${new Date().toLocaleTimeString()}] Completed Step ${step - 1}: ${steps[step - 2].title}`,
        ]);
        if (step === 4) {
          setScoreLift((prev) => prev + 5);
        }
      } else {
        clearInterval(interval);
        setIsProcessing(false);
        setLog((prev) => [
          ...prev,
          `[${new Date().toLocaleTimeString()}] Daily growth cycle complete. Digital score synchronized (+5 pts). Next morning plan prepared.`,
        ]);
        if (onRefreshScore) onRefreshScore();
      }
    }, 800);
  };

  return (
    <div className="space-y-8">
      {/* Engine Header */}
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Cpu className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-bold text-white">Daily Growth Engine Loop</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">
            Designed for local business owners: ~2–5 minutes/day to review and approve growth tasks while STall executes and maintains Google Business Profile integrity.
          </p>
        </div>

        <button
          onClick={runFullCycle}
          disabled={isProcessing}
          className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center space-x-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50 transition"
        >
          {isProcessing ? (
            <RotateCw className="w-4 h-4 animate-spin" />
          ) : (
            <Play className="w-4 h-4 fill-current" />
          )}
          <span>{isProcessing ? 'Executing Loop...' : 'Simulate Daily Cycle Now'}</span>
        </button>
      </div>

      {/* 5-Step Pipeline Visualization */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        {steps.map((s) => {
          const isActive = currentStep === s.num;
          const isPassed = currentStep > s.num;

          return (
            <div
              key={s.num}
              className={`p-4 rounded-xl border transition-all ${
                isActive
                  ? 'bg-emerald-950/30 border-emerald-500 shadow-md shadow-emerald-500/10'
                  : isPassed
                  ? 'bg-slate-900/60 border-slate-800'
                  : 'bg-slate-950/40 border-slate-800/40 opacity-50'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    isActive
                      ? 'bg-emerald-500 text-slate-950'
                      : isPassed
                      ? 'bg-slate-800 text-emerald-400'
                      : 'bg-slate-800 text-slate-500'
                  }`}
                >
                  {isPassed ? <CheckCircle2 className="w-4 h-4" /> : s.num}
                </span>
                {isActive && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                    Active
                  </span>
                )}
              </div>
              <h4 className="text-xs font-bold text-white mb-1">{s.title}</h4>
              <p className="text-[11px] text-slate-400 leading-normal">{s.desc}</p>
            </div>
          );
        })}
      </div>

      {/* Realtime Engine Execution Log */}
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
            <Activity className="w-4 h-4 text-emerald-400" />
            <span>Audit & Verification Logs</span>
          </h3>
          <span className="text-[11px] text-slate-500 font-mono">Real GBP Data Pipeline</span>
        </div>

        <div className="bg-slate-950 rounded-xl p-4 font-mono text-xs text-slate-300 space-y-1.5 max-h-56 overflow-y-auto border border-slate-800">
          {log.map((line, idx) => (
            <div key={idx} className="text-emerald-400/90 leading-relaxed">
              {line}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
