import { PlatformType, MultiPlatformOAuthConfig, PlatformAuthSession } from '../types';

const OAUTH_STORAGE_KEY = 'stall_multiplatform_oauth_config';
const GBP_SCOPE = 'https://www.googleapis.com/auth/business.manage';
export const AUTH_BROADCAST_CHANNEL = 'stall_oauth_channel';

// Registered Production Web OAuth Client ID in Google Cloud Console
export const PRODUCTION_WEB_CLIENT_ID = '425143387624-70ocqm35disu7hdtng963g0u40rmkmhm.apps.googleusercontent.com';

export interface OAuthResult {
  accessToken?: string;
  expiresIn?: number;
  platform?: PlatformType;
  error?: string;
  errorDescription?: string;
}

export const DEFAULT_OAUTH_CONFIG: MultiPlatformOAuthConfig = {
  webClientId: PRODUCTION_WEB_CLIENT_ID,
  androidClientId: '',
  androidPackageName: 'com.stall.partner',
  iosClientId: '',
  iosBundleId: 'com.stall.partner',
  redirectUriWeb: '',
  redirectUriAndroid: 'com.stall.partner://oauth2redirect',
  redirectUriIOS: 'com.stall.partner://oauth2callback',
};

export const PlatformAuthService = {
  detectPlatform(): PlatformType {
    if (typeof window === 'undefined') return 'web';
    const ua = navigator.userAgent || navigator.vendor || (window as unknown as { opera?: string }).opera || '';

    if ((window as unknown as { AndroidBridge?: unknown }).AndroidBridge || /android/i.test(ua)) {
      return 'android';
    }
    if ((window as unknown as { webkit?: { messageHandlers?: unknown } }).webkit?.messageHandlers || /iPad|iPhone|iPod/.test(ua)) {
      return 'ios';
    }
    return 'web';
  },

  isPreviewEnvironment(): boolean {
    if (typeof window === 'undefined') return false;
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  },

  /**
   * Generates the canonical redirect URI matching the deployed Cloud Run origin and path.
   * Strips query parameters (?key=...) and hash fragments to prevent URI mismatches.
   */
  getDefaultRedirectUri(): string {
    if (typeof window === 'undefined') return '';
    let clean = window.location.origin + window.location.pathname;
    clean = clean.split('?')[0].split('#')[0];
    if (!clean.endsWith('/') && !clean.includes('.')) {
      clean += '/';
    }
    return clean;
  },

  getConfig(): MultiPlatformOAuthConfig {
    const raw = sessionStorage.getItem(OAUTH_STORAGE_KEY) || localStorage.getItem(OAUTH_STORAGE_KEY);
    let config: MultiPlatformOAuthConfig = { ...DEFAULT_OAUTH_CONFIG };

    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          config = { ...config, ...parsed };
        }
      } catch {
        // use default
      }
    }

    // Guard: Never allow an empty string or non-client-id string to override the production Web Client ID
    const webId = (config.webClientId || '').trim();
    if (!webId || !webId.includes('.apps.googleusercontent.com')) {
      config.webClientId = PRODUCTION_WEB_CLIENT_ID;
      this.saveConfig(config);
    }

    if (!config.redirectUriWeb || config.redirectUriWeb.trim() === '') {
      config.redirectUriWeb = this.getDefaultRedirectUri();
    }

    return config;
  },

  saveConfig(config: MultiPlatformOAuthConfig) {
    const safeWebId = (config.webClientId && config.webClientId.trim().includes('.apps.googleusercontent.com'))
      ? config.webClientId.trim()
      : PRODUCTION_WEB_CLIENT_ID;

    const safeConfig: MultiPlatformOAuthConfig = {
      ...config,
      webClientId: safeWebId,
    };

    sessionStorage.setItem(OAUTH_STORAGE_KEY, JSON.stringify(safeConfig));
    localStorage.setItem(OAUTH_STORAGE_KEY, JSON.stringify(safeConfig));
    sessionStorage.setItem('stall_google_client_id', safeWebId);
    localStorage.setItem('stall_google_client_id', safeWebId);
  },

  /**
   * Constructs the top-level Google OAuth 2.0 authorization URL.
   * Uses implicit grant (response_type=token) for client-side SPA.
   * Client secret is NEVER required or included.
   */
  buildAuthUri(platform: PlatformType, config: MultiPlatformOAuthConfig): { url: string; clientId: string; redirectUri: string } {
    let rawClientId = (config.webClientId || PRODUCTION_WEB_CLIENT_ID).trim();
    if (!rawClientId || !rawClientId.includes('.apps.googleusercontent.com')) {
      rawClientId = PRODUCTION_WEB_CLIENT_ID;
    }

    if (platform === 'android' && config.androidClientId && config.androidClientId.trim()) {
      rawClientId = config.androidClientId.trim();
    } else if (platform === 'ios' && config.iosClientId && config.iosClientId.trim()) {
      rawClientId = config.iosClientId.trim();
    }

    const defaultWebRedirect = this.getDefaultRedirectUri();
    let redirectUri = defaultWebRedirect;

    if (platform === 'web') {
      let candidate = (config.redirectUriWeb && config.redirectUriWeb.trim()) || defaultWebRedirect;
      candidate = candidate.split('?')[0].split('#')[0];
      if (!candidate.endsWith('/') && !candidate.includes('.')) {
        candidate += '/';
      }
      redirectUri = candidate;
    } else if (platform === 'android') {
      redirectUri = config.redirectUriAndroid;
    } else if (platform === 'ios') {
      redirectUri = config.redirectUriIOS;
    }

    const authEndpoint = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authEndpoint.searchParams.set('client_id', rawClientId);
    authEndpoint.searchParams.set('redirect_uri', redirectUri);
    authEndpoint.searchParams.set('response_type', 'token');
    authEndpoint.searchParams.set('scope', GBP_SCOPE);
    authEndpoint.searchParams.set('include_granted_scopes', 'true');
    authEndpoint.searchParams.set('prompt', 'select_account consent');
    authEndpoint.searchParams.set('state', JSON.stringify({ platform, ts: Date.now() }));

    return {
      url: authEndpoint.toString(),
      clientId: rawClientId,
      redirectUri,
    };
  },

  /**
   * Strictly extracts OAuth access token from the URL hash fragment (#).
   * Decodes percent-escaped characters while ignoring Cloud Run ?key= query parameters.
   * Access tokens are treated as opaque strings without prefix assumptions.
   */
  extractOAuthResult(uriString: string): OAuthResult {
    try {
      if (!uriString) return {};

      let paramString = '';
      const hashIndex = uriString.indexOf('#');
      if (hashIndex !== -1) {
        paramString = uriString.substring(hashIndex + 1);
      } else {
        const qIdx = uriString.indexOf('?');
        if (qIdx !== -1) {
          paramString = uriString.substring(qIdx + 1);
        }
      }

      if (!paramString) return {};

      paramString = paramString.replace(/^[#/\\?]+/, '');

      const map: Record<string, string> = {};
      const pairs = paramString.split('&');
      for (const pair of pairs) {
        if (!pair) continue;
        const eqIdx = pair.indexOf('=');
        if (eqIdx !== -1) {
          const rawKey = pair.substring(0, eqIdx).trim();
          const rawVal = pair.substring(eqIdx + 1).trim();
          let decodedVal = rawVal;
          try {
            decodedVal = decodeURIComponent(rawVal);
          } catch {
            decodedVal = rawVal;
          }
          map[rawKey] = decodedVal;
        }
      }

      if (map['error']) {
        return {
          error: map['error'],
          errorDescription: map['error_description'] || undefined,
        };
      }

      const rawToken = map['access_token'];
      if (!rawToken) return {};

      let accessToken = rawToken.replace(/^Bearer\s+/i, '').trim();
      accessToken = accessToken.replace(/^["']|["']$/g, '');

      // Reject non-OAuth credentials
      if (accessToken.startsWith('AIzaSy') || accessToken.includes('.apps.googleusercontent.com') || accessToken.startsWith('eyJ')) {
        return {};
      }

      const expiresIn = parseInt(map['expires_in'] || '3600', 10);
      const returnedScope = map['scope'];

      if (returnedScope && !returnedScope.includes('business.manage')) {
        return {
          error: 'insufficient_scope',
          errorDescription: 'The granted Google token is missing the required business.manage scope.',
        };
      }

      let platform: PlatformType | undefined;
      if (map['state']) {
        try {
          const parsed = JSON.parse(map['state']);
          if (parsed.platform) platform = parsed.platform;
        } catch {
          // ignore
        }
      }

      return {
        accessToken,
        expiresIn,
        platform,
      };
    } catch {
      return {};
    }
  },

  broadcastAuthSuccess(session: PlatformAuthSession) {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const channel = new BroadcastChannel(AUTH_BROADCAST_CHANNEL);
        channel.postMessage({ type: 'STALL_GBP_AUTH_SUCCESS', session });
        channel.close();
      } catch {
        // ignore
      }
    }
  },

  listenForNativeAppTokens(onTokenReceived: (session: PlatformAuthSession) => void): () => void {
    const handleMessage = (event: MessageEvent) => {
      if (!event.data) return;

      if (typeof event.data === 'string' && event.data.startsWith('stall-oauth-callback:')) {
        const rawUri = event.data.replace('stall-oauth-callback:', '');
        const res = this.extractOAuthResult(rawUri);
        if (res.accessToken) {
          onTokenReceived({
            platform: res.platform || 'web',
            accessToken: res.accessToken,
            expiresAt: Date.now() + (res.expiresIn || 3600) * 1000,
            scopes: [GBP_SCOPE],
          });
        }
      } else if (event.data?.type === 'STALL_GBP_AUTH_SUCCESS') {
        const session = event.data.session || {
          platform: event.data.platform || 'web',
          accessToken: (event.data.accessToken || '').replace(/^Bearer\s+/i, '').trim(),
          expiresAt: Date.now() + (event.data.expiresIn || 3600) * 1000,
          scopes: [GBP_SCOPE],
        };
        if (session.accessToken) {
          onTokenReceived(session);
        }
      }
    };

    window.addEventListener('message', handleMessage);

    let channel: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        channel = new BroadcastChannel(AUTH_BROADCAST_CHANNEL);
        channel.onmessage = (event) => {
          if (event.data?.type === 'STALL_GBP_AUTH_SUCCESS' && event.data.session) {
            onTokenReceived(event.data.session);
          }
        };
      } catch {
        channel = null;
      }
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key === 'stall_gbp_access_token' && event.newValue) {
        onTokenReceived({
          platform: 'web',
          accessToken: event.newValue,
          expiresAt: Date.now() + 3600 * 1000,
          scopes: [GBP_SCOPE],
        });
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('storage', handleStorage);
      if (channel) {
        channel.close();
      }
    };
  }
};
