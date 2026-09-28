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
import { CheckCircle2, ShieldAlert, RefreshCw } from 'lucide-react';

export const App: React.FC = () => {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [platformSource, setPlatformSource] = useState<PlatformType>('web');
  const [profile, setProfile] = useState<STallBusinessProfile | null>(null);
  const [isSelectingLocation, setIsSelectingLocation] = useState(false);
  const [isProvisioningStore, setIsProvisioningStore] = useState(false);
  const [provisioningMessage, setProvisioningMessage] = useState('');
  const [activeTab, setActiveTab] = useState<'today' | 'results' | 'business' | 'growth'>('today');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isCallbackHandoffTab, setIsCallbackHandoffTab] = useState(false);

  useEffect(() => {
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

      try {
        GoogleBusinessService.clearSession();
        GoogleBusinessService.setAccessToken(freshToken, expiresIn);

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
                expiresIn,
                platform,
              },
              '*'
            );
          } catch {
            // cross-origin opener
          }
          setIsCallbackHandoffTab(true);
          setTimeout(() => {
            try { window.close(); } catch { /* ignore */ }
          }, 1200);
          return;
        }

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

  /**
   * A Google location is not considered provisioned merely because it was selected.
   * We re-fetch the exact location and then hydrate the STall profile with live
   * reviews and the 30-day Performance API dataset. Optional data failures are
   * retained as unavailable rather than fabricated as zeros.
   */
  const handleLocationSelected = async (accountName: string, location: GoogleLocation) => {
    if (!accessToken) {
      setLoginError('Google session is missing. Please reconnect your Google Business Profile.');
      return;
    }

    setIsProvisioningStore(true);
    setProvisioningMessage('Verifying the selected Google Business Profile location...');
    setLoginError(null);

    try {
      const exactLocation = await GoogleBusinessService.fetchLocationDetail(location.name, accessToken);

      if (!exactLocation.name || !exactLocation.name.includes('/locations/')) {
        throw new Error('Google returned an invalid location resource. The store was not provisioned.');
      }

      const stallProfile = GoogleBusinessService.mapGoogleLocationToSTallProfile(accountName, exactLocation);
      stallProfile.platformSource = platformSource;
      stallProfile.connectedAt = new Date().toISOString();

      setProvisioningMessage('Fetching live Google reviews and rating...');
      try {
        const reviewData = await GoogleBusinessService.fetchReviews(
          accountName,
          exactLocation.name,
          accessToken
        );
        stallProfile.reviews = reviewData.reviews;
        stallProfile.googleAverageRating = reviewData.averageRating ?? null;
        stallProfile.googleTotalReviewCount = reviewData.totalReviewCount ?? null;
      } catch (err) {
        console.warn('[STall GBP] Review sync unavailable during provisioning:', err);
        stallProfile.reviews = [];
        stallProfile.googleAverageRating = null;
        stallProfile.googleTotalReviewCount = null;
      }

      setProvisioningMessage('Fetching Google Performance data for the latest 30-day window...');
      try {
        stallProfile.performance = await GoogleBusinessService.fetchPerformanceMetrics(
          exactLocation.name,
          30,
          accessToken
        );
      } catch (err) {
        console.warn('[STall GBP] Performance sync unavailable during provisioning:', err);
        stallProfile.performance = undefined;
      }

      // Persist only the selected, exact Google location as the STall business.
      // No device location, Places search result, fallback business, or fabricated
      // values are used for provisioning.
      GoogleBusinessService.setStoredBusinessProfile(stallProfile);
      localStorage.setItem('stall_selected_account', accountName);
      localStorage.setItem('stall_selected_location', exactLocation.name);

      setProvisioningMessage('Store connected successfully.');
      setProfile(stallProfile);
      setIsSelectingLocation(false);
    } catch (err) {
      console.error('[STall GBP] Store provisioning failed:', err);
      const msg = err instanceof Error
        ? err.message
        : 'Google store provisioning failed. Please select the store again.';
      setLoginError(msg);
    } finally {
      setIsProvisioningStore(false);
    }
  };

  const handlePreviewSandboxLaunch = (sandboxProfile: STallBusinessProfile) => {
    setAccessToken('preview-dev-session-token');
    setProfile(sandboxProfile);
    setPlatformSource(sandboxProfile.platformSource || 'web');
    setIsSelectingLocation(false);
  };

  const handleLogout = () => {
    GoogleBusinessService.clearSession();
    localStorage.removeItem('stall_selected_account');
    localStorage.removeItem('stall_selected_location');
    setAccessToken(null);
    setProfile(null);
    setIsSelectingLocation(false);
    setIsProvisioningStore(false);
    setProvisioningMessage('');
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

            {isSelectingLocation && accessToken && !isProvisioningStore && (
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

            {isProvisioningStore && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-6">
                <div className="w-full max-w-md rounded-2xl border border-emerald-500/20 bg-slate-900 p-7 text-center shadow-2xl">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
                    <RefreshCw className="h-6 w-6 animate-spin" />
                  </div>
                  <h2 className="text-lg font-bold text-white">Connecting your store</h2>
                  <p className="mt-2 text-sm text-slate-400">{provisioningMessage || 'Provisioning live Google Business Profile data...'}</p>
                  <p className="mt-4 text-[11px] text-slate-500">
                    STall will use the exact Google location you selected. No demo or fallback store data is used.
                  </p>
                </div>
              </div>
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
