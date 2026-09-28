import React, { useState } from 'react';
import { STallBusinessProfile, PlatformType } from '../types';
import { 
  Building2, 
  MapPin, 
  ExternalLink, 
  LogOut, 
  ShieldCheck, 
  AlertCircle, 
  Globe, 
  Smartphone, 
  Apple,
  Settings,
  X
} from 'lucide-react';

interface NavbarProps {
  profile: STallBusinessProfile | null;
  platformSource: PlatformType;
  onLogout: () => void;
  activeTab: 'today' | 'results' | 'business' | 'growth';
  setActiveTab: (tab: 'today' | 'results' | 'business' | 'growth') => void;
}

export const Navbar: React.FC<NavbarProps> = ({ profile, platformSource, onLogout, activeTab, setActiveTab }) => {
  const [showSettings, setShowSettings] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo & Identity */}
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 font-black text-slate-950 text-xl tracking-tighter">
                ST
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-white tracking-tight">STall Partner</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono flex items-center space-x-1">
                    {platformSource === 'android' ? (
                      <>
                        <Smartphone className="w-3 h-3" />
                        <span>Android</span>
                      </>
                    ) : platformSource === 'ios' ? (
                      <>
                        <Apple className="w-3 h-3" />
                        <span>iOS</span>
                      </>
                    ) : (
                      <>
                        <Globe className="w-3 h-3" />
                        <span>Web</span>
                      </>
                    )}
                  </span>
                </div>
                <p className="text-xs text-slate-400">Google Business Profile Growth Engine</p>
              </div>
            </div>

            {/* Navigation Tabs (Only when authenticated & profile loaded) */}
            {profile && (
              <nav className="hidden md:flex items-center space-x-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800">
                <button
                  onClick={() => setActiveTab('today')}
                  className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    activeTab === 'today'
                      ? 'bg-emerald-500 text-slate-950 font-semibold shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  Today
                </button>
                <button
                  onClick={() => setActiveTab('results')}
                  className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    activeTab === 'results'
                      ? 'bg-emerald-500 text-slate-950 font-semibold shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  Results
                </button>
                <button
                  onClick={() => setActiveTab('business')}
                  className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    activeTab === 'business'
                      ? 'bg-emerald-500 text-slate-950 font-semibold shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  Business
                </button>
                <button
                  onClick={() => setActiveTab('growth')}
                  className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    activeTab === 'growth'
                      ? 'bg-emerald-500 text-slate-950 font-semibold shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  Growth Engine
                </button>
              </nav>
            )}

            {/* Right Action / Connected GBP Badge */}
            <div className="flex items-center space-x-2">
              {profile ? (
                <div className="flex items-center space-x-2">
                  <div className="hidden lg:flex flex-col text-right pr-2">
                    <div className="flex items-center justify-end space-x-1.5">
                      <span className="text-sm font-medium text-slate-200 truncate max-w-[180px]">
                        {profile.title}
                      </span>
                      {profile.hasVoiceOfMerchant ? (
                        <ShieldCheck className="w-4 h-4 text-emerald-400" title="Google Verified" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-amber-400" title="Pending Verification" />
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => setShowSettings(true)}
                    className="p-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-400 hover:text-white transition"
                    title="Partner Settings"
                  >
                    <Settings className="w-4 h-4" />
                  </button>

                  <button
                    onClick={onLogout}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-rose-950/40 hover:border-rose-800 text-slate-300 hover:text-rose-200 text-xs font-medium transition"
                    title="Disconnect and clear all Google session data"
                  >
                    <LogOut className="w-3.5 h-3.5 text-rose-400" />
                    <span className="hidden sm:inline">Logout</span>
                  </button>
                </div>
              ) : (
                <div className="flex items-center space-x-2 text-xs text-slate-400">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                  <span>Unauthenticated</span>
                </div>
              )}
            </div>
          </div>

          {/* Mobile Navigation Tabs */}
          {profile && (
            <div className="flex md:hidden py-2 border-t border-slate-800/80 space-x-1 overflow-x-auto">
              <button
                onClick={() => setActiveTab('today')}
                className={`px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap ${
                  activeTab === 'today' ? 'bg-emerald-500 text-slate-950 font-bold' : 'text-slate-400'
                }`}
              >
                Today
              </button>
              <button
                onClick={() => setActiveTab('results')}
                className={`px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap ${
                  activeTab === 'results' ? 'bg-emerald-500 text-slate-950 font-bold' : 'text-slate-400'
                }`}
              >
                Results
              </button>
              <button
                onClick={() => setActiveTab('business')}
                className={`px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap ${
                  activeTab === 'business' ? 'bg-emerald-500 text-slate-950 font-bold' : 'text-slate-400'
                }`}
              >
                Business
              </button>
              <button
                onClick={() => setActiveTab('growth')}
                className={`px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap ${
                  activeTab === 'growth' ? 'bg-emerald-500 text-slate-950 font-bold' : 'text-slate-400'
                }`}
              >
                Growth Engine
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Settings Modal */}
      {showSettings && profile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <Settings className="w-4 h-4 text-emerald-400" />
                <span>STall Partner App Settings</span>
              </h3>
              <button
                onClick={() => setShowSettings(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                <span className="text-slate-500 block">Connected Business Account</span>
                <span className="text-white font-mono">{profile.accountName}</span>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                <span className="text-slate-500 block">Google Location ID</span>
                <span className="text-white font-mono">{profile.locationResourceName}</span>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                <span className="text-slate-500 block">Growth Sync Frequency</span>
                <span className="text-emerald-400 font-semibold">Every 24 Hours (Daily Morning Plan)</span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-between items-center">
              <button
                onClick={() => {
                  setShowSettings(false);
                  onLogout();
                }}
                className="text-rose-400 hover:text-rose-300 text-xs font-semibold"
              >
                Disconnect Session
              </button>
              <button
                onClick={() => setShowSettings(false)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
