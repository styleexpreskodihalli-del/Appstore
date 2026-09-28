import React, { useState, useEffect } from 'react';
import { PlatformType, MultiPlatformOAuthConfig, STallBusinessProfile } from '../types';
import { PlatformAuthService, DEFAULT_OAUTH_CONFIG, PRODUCTION_WEB_CLIENT_ID } from '../services/platformAuthService';
import { GoogleBusinessService } from '../services/googleBusinessService';
import {
  Shield,
  AlertTriangle,
  Smartphone,
  Globe,
  Apple,
  Settings2,
  LayoutTemplate
} from 'lucide-react';

interface LoginModalProps {
  onSuccess: (accessToken: string, platform: PlatformType) => void;
  onPreviewSandboxLaunch?: (profile: STallBusinessProfile) => void;
  externalError?: string | null;
}

export const LoginModal: React.FC<LoginModalProps> = ({ onSuccess, onPreviewSandboxLaunch, externalError }) => {
  const [activePlatform, setActivePlatform] = useState<PlatformType>('web');
  const [config, setConfig] = useState<MultiPlatformOAuthConfig>(DEFAULT_OAUTH_CONFIG);
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [authError, setAuthError] = useState<string | null>(externalError || null);
  const [showConfig, setShowConfig] = useState(false);
  const [clientIdInput, setClientIdInput] = useState(PRODUCTION_WEB_CLIENT_ID);
  const [redirectUriInput, setRedirectUriInput] = useState('');

  const isPreview = PlatformAuthService.isPreviewEnvironment();

  useEffect(() => {
    if (externalError) {
      setAuthError(externalError);
    }
  }, [externalError]);

  useEffect(() => {
    const detected = PlatformAuthService.detectPlatform();
    setActivePlatform(detected);

    const loadedConfig = PlatformAuthService.getConfig();
    setConfig(loadedConfig);
    setClientIdInput(loadedConfig.webClientId || PRODUCTION_WEB_CLIENT_ID);
    setRedirectUriInput(loadedConfig.redirectUriWeb || PlatformAuthService.getDefaultRedirectUri());

    const unsubscribe = PlatformAuthService.listenForNativeAppTokens((session) => {
      setIsAuthorizing(false);
      onSuccess(session.accessToken, session.platform);
    });

    return () => unsubscribe();
  }, [onSuccess]);

  const handleSaveSettings = () => {
    const resolvedClientId = clientIdInput.trim() || PRODUCTION_WEB_CLIENT_ID;
    const resolvedRedirectUri = redirectUriInput.trim() || PlatformAuthService.getDefaultRedirectUri();

    const updated: MultiPlatformOAuthConfig = {
      ...config,
      webClientId: activePlatform === 'web' ? resolvedClientId : config.webClientId,
      androidClientId: activePlatform === 'android' ? resolvedClientId : config.androidClientId,
      iosClientId: activePlatform === 'ios' ? resolvedClientId : config.iosClientId,
      redirectUriWeb: resolvedRedirectUri,
    };
    setConfig(updated);
    PlatformAuthService.saveConfig(updated);
    setShowConfig(false);
  };

  const handleLaunchProductionOAuth = () => {
    setAuthError(null);

    if (isPreview) {
      setAuthError('Google Login will be available after deployment. OAuth cannot be completed inside this preview.');
      return;
    }

    const currentClientId = (clientIdInput || config.webClientId || PRODUCTION_WEB_CLIENT_ID).trim();
    if (!currentClientId) {
      setShowConfig(true);
      setAuthError('Please configure your Google Cloud OAuth Client ID for your deployment domain.');
      return;
    }

    const resolvedRedirectUri = (redirectUriInput || config.redirectUriWeb || PlatformAuthService.getDefaultRedirectUri()).trim();

    const updatedConfig: MultiPlatformOAuthConfig = {
      ...config,
      webClientId: currentClientId,
      redirectUriWeb: resolvedRedirectUri,
    };
    setConfig(updatedConfig);
    PlatformAuthService.saveConfig(updatedConfig);

    // Completely purge any stale tokens before launching fresh Google OAuth
    GoogleBusinessService.clearSession();

    try {
      setIsAuthorizing(true);
      const { url, clientId, redirectUri } = PlatformAuthService.buildAuthUri(activePlatform, updatedConfig);
      
      console.debug('[STall GBP] Launching Google OAuth authorization:', {
        clientIdConfigured: Boolean(clientId),
        redirectUri,
        scope: 'https://www.googleapis.com/auth/business.manage',
      });

      window.location.assign(url);
    } catch (err: unknown) {
      setIsAuthorizing(false);
      setAuthError(err instanceof Error ? err.message : 'Failed to launch Google OAuth authorization.');
    }
  };

  const handleEnterPreviewSandbox = () => {
    if (!onPreviewSandboxLaunch) return;
    const devSandboxProfile: STallBusinessProfile = {
      accountName: 'accounts/dev-preview-sandbox',
      locationResourceName: 'locations/dev-preview-sandbox-loc',
      title: 'Partner Sandbox Location (Preview Mode)',
      placeId: 'ChIJ_DEV_PREVIEW_PLACE_ID_VALIDATION',
      phone: '+1 (555) 019-2834',
      website: 'https://example-partner.stall.com',
      formattedAddress: '742 Evergreen Terrace, Suite 100, Springfield, IL 62704, US',
      coordinates: { lat: 39.7817, lng: -89.6501 },
      primaryCategory: 'Coffee Shop & Local Eatery',
      additionalCategories: ['Bakery', 'Espresso Bar', 'Cafe'],
      mapsUri: 'https://maps.google.com',
      hasVoiceOfMerchant: true,
      hasPendingEdits: false,
      openHoursSummary: '7 daily time slots configured (Mon-Sun 07:00 - 19:00)',
      rawGoogleLocation: {
        name: 'locations/dev-preview-sandbox-loc',
        title: 'Partner Sandbox Location (Preview Mode)',
      },
      connectedAt: new Date().toISOString(),
      platformSource: activePlatform,
      isPreviewDevSession: true,
      services: [
        { id: 'srv-1', displayName: 'Single Origin Pour Over', category: 'Beverages', price: '$5.50', isAvailableOnGoogle: true, description: 'Rotating micro-lot Ethiopian and Colombian single origins.' },
        { id: 'srv-2', displayName: 'Artisan Pastry Box', category: 'Bakery', price: '$14.00', isAvailableOnGoogle: true, description: 'Fresh morning croissants and pain au chocolat.' },
        { id: 'srv-3', displayName: 'Cold Brew Subscription', category: 'Subscriptions', price: '$24.00', isAvailableOnGoogle: false, description: 'Weekly refill growlers for local offices.' }
      ],
      reviews: [
        { id: 'rev-1', reviewerName: 'Marcus Vance', starRating: 5, comment: 'Phenomenal local spot! Best flat white in town and ultra-fast WiFi.', createTime: '2 days ago' },
        { id: 'rev-2', reviewerName: 'Elena Rostova', starRating: 4, comment: 'Great atmosphere, would love to see more vegan morning options.', createTime: '1 week ago', reviewReply: { comment: 'Thank you Elena! We are expanding our plant-based bakery menu this month.', updateTime: '5 days ago' } }
      ],
      offers: [
        { id: 'off-1', title: 'Local Neighbor 15% Off First Order', couponCode: 'NEIGHBOR15', discountSummary: '15% discount on all beverages', validThrough: 'Next Sunday', status: 'ACTIVE', redeemedCount: 42 }
      ]
    };
    onPreviewSandboxLaunch(devSandboxProfile);
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute -top-24 -left-24 w-60 h-60 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-24 -right-24 w-60 h-60 bg-teal-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 font-black text-2xl shadow-xl shadow-emerald-500/20 mb-3">
              ST
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">STall Partner Login</h1>
            <p className="text-slate-400 text-xs mt-1">
              Google Business Profile (GBP) API v1 • Live Connection
            </p>
          </div>

          {isPreview && (
            <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-3">
              <div className="flex items-start space-x-2.5 text-amber-300">
                <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs leading-relaxed">
                  <span className="font-bold block text-amber-200">
                    Google Login will be available after deployment. OAuth cannot be completed inside this preview.
                  </span>
                  Google enforces <code className="text-amber-200 font-mono">X-Frame-Options: DENY</code>. Use the sandbox launcher below to inspect the MVP UI.
                </div>
              </div>

              {onPreviewSandboxLaunch && (
                <button
                  type="button"
                  onClick={handleEnterPreviewSandbox}
                  className="w-full py-2.5 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center space-x-2 transition shadow-md"
                >
                  <LayoutTemplate className="w-4 h-4" />
                  <span>Launch UI Sandbox Preview Mode</span>
                </button>
              )}
            </div>
          )}

          {/* Platform Client Selector */}
          <div className="mb-6">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              <span>Target Platform Client</span>
              <span className="text-[11px] text-emerald-400 normal-case font-mono">
                Single GBP Backend
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 p-1.5 bg-slate-950/80 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setActivePlatform('web');
                  setClientIdInput(config.webClientId || PRODUCTION_WEB_CLIENT_ID);
                }}
                className={`flex items-center justify-center space-x-2 py-2 px-3 rounded-lg text-xs font-semibold transition ${
                  activePlatform === 'web'
                    ? 'bg-emerald-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Web App</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActivePlatform('android');
                  setClientIdInput(config.androidClientId || config.webClientId || PRODUCTION_WEB_CLIENT_ID);
                }}
                className={`flex items-center justify-center space-x-2 py-2 px-3 rounded-lg text-xs font-semibold transition ${
                  activePlatform === 'android'
                    ? 'bg-emerald-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Android App</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActivePlatform('ios');
                  setClientIdInput(config.iosClientId || config.webClientId || PRODUCTION_WEB_CLIENT_ID);
                }}
                className={`flex items-center justify-center space-x-2 py-2 px-3 rounded-lg text-xs font-semibold transition ${
                  activePlatform === 'ios'
                    ? 'bg-emerald-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Apple className="w-3.5 h-3.5" />
                <span>iOS App</span>
              </button>
            </div>
          </div>

          {authError && (
            <div className="mb-6 p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-start space-x-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{authError}</div>
            </div>
          )}

          {/* Production Flow: Connect with Google */}
          <div className="space-y-4">
            <button
              onClick={handleLaunchProductionOAuth}
              disabled={isAuthorizing}
              className={`w-full flex items-center justify-center space-x-3 py-3.5 px-4 rounded-xl font-semibold shadow-lg transition-all ${
                isPreview
                  ? 'bg-slate-800 text-slate-400 hover:bg-slate-800 cursor-not-allowed border border-slate-700'
                  : 'bg-white hover:bg-slate-100 text-slate-900 shadow-white/5'
              }`}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>
                {isPreview
                  ? 'Connect with Google (Active on Deployment)'
                  : isAuthorizing
                  ? 'Redirecting to Google...'
                  : 'Connect with Google'}
              </span>
            </button>

            <div className="flex items-center space-x-2 text-xs text-slate-400 justify-center">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <span>Scope: <code className="text-slate-300">https://www.googleapis.com/auth/business.manage</code></span>
            </div>
          </div>

          <div className="mt-6 pt-5 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setShowConfig(!showConfig)}
              className="w-full flex items-center justify-between text-xs text-slate-400 hover:text-slate-200 py-1"
            >
              <span className="flex items-center space-x-1.5 font-medium">
                <Settings2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Deployment & OAuth Callback Configuration</span>
              </span>
              <span className="text-slate-500">{showConfig ? 'Close' : 'Configure'}</span>
            </button>

            {showConfig && (
              <div className="mt-3 p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3 text-xs">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Google OAuth Client ID ({activePlatform.toUpperCase()})
                  </label>
                  <input
                    type="text"
                    value={clientIdInput}
                    onChange={(e) => setClientIdInput(e.target.value)}
                    placeholder="e.g. 123456789-web.apps.googleusercontent.com"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500 font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Configurable Deployment Redirect URI
                  </label>
                  <input
                    type="text"
                    value={redirectUriInput}
                    onChange={(e) => setRedirectUriInput(e.target.value)}
                    placeholder="e.g. https://your-production-domain.com"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500 font-mono text-xs"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleSaveSettings}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg text-xs"
                >
                  Save Configuration
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
