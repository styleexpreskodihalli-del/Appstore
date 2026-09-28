import React, { useState, useEffect } from 'react';
import { GoogleBusinessService, validateAndCleanToken } from './services/googleBusinessService';
import { PlatformAuthService } from './services/platformAuthService';
import { STallBusinessProfile, GoogleLocation, PlatformType } from './types';
import { Navbar } from './components/Navbar';
import { LoginModal } from './components/LoginModal';
import { LocationPickerModal } from './components/LocationPickerModal';
import { TodayTab } from './components/TodayTab';
import { ResultsTab } from './components/ResultsTab';
import { BusinessTab } from './components/BusinessTab';
import { GrowthEngineTab } from './components/GrowthEngineTab';
import { CheckCircle2, ShieldAlert } from 'lucide-react';

export const App: React.FC = () => {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [platformSource, setPlatformSource] = useState<PlatformType>('web');
  const [profile, setProfile] = useState<STallBusinessProfile | null>(null);
  const [isSelectingLocation, setIsSelectingLocation] = useState(false);
  const [activeTab, setActiveTab] = useState<'today' | 'results' | 'business' | 'growth'>('today');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isCallbackHandoffTab, setIsCallbackHandoffTab] = useState(false);

  useEffect(() => {
    // 1. Check for incoming Google OAuth redirect callback in the URL
    const authResult = PlatformAuthService.extractOAuthResult(window.location.href);

    if (authResult.error) {
      const errMessage = `Google OAuth Error: ${authResult.error}${authResult.errorDescription ? ` — ${authResult.errorDescription}` : ''}`;
      console.error('[STall GBP]', errMessage);
      setLoginError(errMessage);
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      return;
    }

    if (authResult.accessToken) {
      const freshToken = authResult.accessToken;
      const expiresIn = authResult.expiresIn || 3600;
      const platform = authResult.platform || 'web';

      console.debug('[STall GBP] Captured fresh OAuth access token from callback', {
        tokenReceived: true,
        tokenLength: freshToken.length,
        expiresIn,
        platform,
      });

      try {
        // Store the fresh token immediately
        GoogleBusinessService.clearSession();
        GoogleBusinessService.setAccessToken(freshToken, expiresIn);

        // Notify other windows/tabs if running inside popup
        PlatformAuthService.broadcastAuthSuccess({
          platform,
          accessToken: freshToken,
          expiresAt: Date.now() + expiresIn * 1000,
          scopes: ['https://www.googleapis.com/auth/business.manage'],
        });

        if (window.opener && window.opener !== window) {
          try {
            window.opener.postMessage(
              {
                type: 'STALL_GBP_AUTH_SUCCESS',
                accessToken: freshToken,
                expiresIn: expiresIn,
                platform: platform,
              },
              '*'
            );
          } catch {
            // cross-origin opener
          }
          setIsCallbackHandoffTab(true);
          setTimeout(() => {
            try {
              window.close();
            } catch {
              // ignore
            }
          }, 1200);
          return;
        }

        // Clean the hash fragment from address bar, preserving ?key= query
        window.history.replaceState(null, '', window.location.pathname + window.location.search);

        setAccessToken(freshToken);
        setPlatformSource(platform);
        setLoginError(null);
        setIsSelectingLocation(true);
        return;
      } catch (err) {
        console.error('[STall GBP] Failed to store OAuth access token:', err);
        setLoginError(err instanceof Error ? err.message : 'Invalid access token received from Google.');
        handleLogout();
        return;
      }
    }

    // 2. Load existing stored session only if no OAuth callback was present in URL
    const storedToken = GoogleBusinessService.getStoredAccessToken();
    const storedProfile = GoogleBusinessService.getStoredBusinessProfile();
    const detectedPlatform = PlatformAuthService.detectPlatform();
    setPlatformSource(detectedPlatform);

    if (storedToken) {
      try {
        validateAndCleanToken(storedToken);
        setAccessToken(storedToken);
        if (storedProfile) {
          setProfile(storedProfile);
          if (storedProfile.platformSource) {
            setPlatformSource(storedProfile.platformSource);
          }
        } else {
          // Token exists, proceed to account & location selection
          setIsSelectingLocation(true);
        }
      } catch {
        GoogleBusinessService.clearSession();
      }
    }
  }, []);

  const handleAuthSuccess = (token: string, platform: PlatformType) => {
    try {
      GoogleBusinessService.setAccessToken(token);
      const cleanToken = GoogleBusinessService.getStoredAccessToken();
      if (!cleanToken) {
        throw new Error('Could not validate received Google OAuth access token.');
      }
      setAccessToken(cleanToken);
      setPlatformSource(platform);
      setLoginError(null);
      setIsSelectingLocation(true);
    } catch (err) {
      console.error('[STall GBP] Auth success handler failed:', err);
      setLoginError(err instanceof Error ? err.message : 'Authentication initialization failed');
      handleLogout();
    }
  };

  const handleLocationSelected = (accountName: string, location: GoogleLocation) => {
    console.debug('[STall GBP] Location selected by user:', location.title || location.name);
    const stallProfile = GoogleBusinessService.mapGoogleLocationToSTallProfile(accountName, location);
    stallProfile.platformSource = platformSource;
    GoogleBusinessService.setStoredBusinessProfile(stallProfile);
    setProfile(stallProfile);
    setIsSelectingLocation(false);
  };

  const handlePreviewSandboxLaunch = (sandboxProfile: STallBusinessProfile) => {
    setAccessToken('preview-dev-session-token');
    setProfile(sandboxProfile);
    setPlatformSource(sandboxProfile.platformSource || 'web');
    setIsSelectingLocation(false);
  };

  const handleLogout = () => {
    GoogleBusinessService.clearSession();
    setAccessToken(null);
    setProfile(null);
    setIsSelectingLocation(false);
    setActiveTab('today');
  };

  if (isCallbackHandoffTab) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6 text-center">
        <div className="p-8 bg-slate-900 border border-slate-800 rounded-2xl max-w-md shadow-2xl space-y-4">
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/20">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-white">Signed into Google!</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            Your Google Business Profile authorization was synchronized with STall. This window will now close.
          </p>
          <button
            onClick={() => window.close()}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg"
          >
            Close Window
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {profile?.isPreviewDevSession && (
        <div className="bg-amber-500/20 border-b border-amber-500/30 px-4 py-1.5 text-center text-xs text-amber-300 font-medium flex items-center justify-center space-x-2">
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>PREVIEW SANDBOX: UI Validation Mode (Isolated from production path)</span>
          <button onClick={handleLogout} className="underline text-amber-200 ml-2 hover:text-white">Exit Preview</button>
        </div>
      )}

      <Navbar
        profile={profile}
        platformSource={platformSource}
        onLogout={handleLogout}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!accessToken || !profile ? (
          <div>
            <LoginModal
              onSuccess={handleAuthSuccess}
              onPreviewSandboxLaunch={handlePreviewSandboxLaunch}
              externalError={loginError}
            />

            {isSelectingLocation && accessToken && (
              <LocationPickerModal
                accessToken={accessToken}
                onLocationSelected={handleLocationSelected}
                onAuthError={(errMsg) => {
                  console.error('[STall GBP] LocationPickerModal reported auth error:', errMsg);
                  setLoginError(errMsg);
                }}
                onCancel={() => {
                  setIsSelectingLocation(false);
                  handleLogout();
                }}
              />
            )}
          </div>
        ) : (
          <div>
            {activeTab === 'today' && (
              <TodayTab
                profile={profile}
                onUpdateProfile={setProfile}
                onNavigateToGrowth={() => setActiveTab('growth')}
              />
            )}
            {activeTab === 'results' && <ResultsTab profile={profile} />}
            {activeTab === 'business' && <BusinessTab profile={profile} />}
            {activeTab === 'growth' && <GrowthEngineTab profile={profile} />}
          </div>
        )}
      </main>

      <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-500">
        STall Partner • Multi-Platform OAuth (Web / Google Play Store / Apple App Store) • Powered by Google Business Profile API v1
      </footer>
    </div>
  );
};

export default App;
