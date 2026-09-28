import React, { useState, useEffect } from 'react';
import { GoogleAccount, GoogleLocation } from '../types';
import { GoogleBusinessService } from '../services/googleBusinessService';
import { Building2, MapPin, AlertCircle, RefreshCw, ChevronRight, LogOut } from 'lucide-react';

interface LocationPickerModalProps {
  accessToken: string;
  onLocationSelected: (accountName: string, location: GoogleLocation) => void;
  onAuthError?: (errorMessage: string) => void;
  onCancel: () => void;
}

export const LocationPickerModal: React.FC<LocationPickerModalProps> = ({
  accessToken,
  onLocationSelected,
  onAuthError,
  onCancel,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<GoogleAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [locations, setLocations] = useState<GoogleLocation[]>([]);
  const [locationsLoading, setLocationsLoading] = useState(false);
  const [fetchingDetailId, setFetchingDetailId] = useState<string | null>(null);

  // 1. Automatically fetch real Google Business Profile accounts when fresh accessToken arrives
  useEffect(() => {
    let isMounted = true;

    const loadAccounts = async () => {
      if (!accessToken || accessToken.trim() === '') {
        const msg = 'No valid OAuth 2.0 access token found. Please authenticate.';
        setError(msg);
        setLoading(false);
        if (onAuthError) onAuthError(msg);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        // Direct call to GET https://mybusinessaccountmanagement.googleapis.com/v1/accounts
        const fetchedAccounts = await GoogleBusinessService.fetchAccounts(accessToken);
        if (!isMounted) return;

        setAccounts(fetchedAccounts);
        if (fetchedAccounts.length > 0) {
          // Select first real account to trigger location loading
          setSelectedAccount(fetchedAccounts[0].name);
        } else {
          setError('No Google Business Profile accounts found for this authenticated user.');
        }
      } catch (err: unknown) {
        if (!isMounted) return;
        const msg = err instanceof Error ? err.message : 'Failed to retrieve Google accounts.';
        setError(msg);
        // If 401/403 authentication error, clear session and inform parent
        if (
          msg.includes('401') ||
          msg.includes('403') ||
          msg.toLowerCase().includes('credential') ||
          msg.toLowerCase().includes('unauthenticated')
        ) {
          GoogleBusinessService.clearSession();
          if (onAuthError) {
            onAuthError(msg);
          }
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadAccounts();
    return () => {
      isMounted = false;
    };
  }, [accessToken, onAuthError]);

  // 2. Automatically fetch real locations when selectedAccount or accessToken updates
  useEffect(() => {
    if (!selectedAccount) return;
    let isMounted = true;

    const loadLocations = async () => {
      setLocationsLoading(true);
      setError(null);
      try {
        // Direct call to GET https://mybusinessbusinessinformation.googleapis.com/v1/{accountName}/locations
        const fetchedLocations = await GoogleBusinessService.fetchAccountLocations(
          selectedAccount,
          accessToken
        );
        if (!isMounted) return;
        setLocations(fetchedLocations);
      } catch (err: unknown) {
        if (!isMounted) return;
        const msg = err instanceof Error ? err.message : 'Failed to retrieve account locations from Google.';
        setError(msg);
        if (
          msg.includes('401') ||
          msg.includes('403') ||
          msg.toLowerCase().includes('credential') ||
          msg.toLowerCase().includes('unauthenticated')
        ) {
          GoogleBusinessService.clearSession();
          if (onAuthError) {
            onAuthError(msg);
          }
        }
      } finally {
        if (isMounted) setLocationsLoading(false);
      }
    };

    loadLocations();
    return () => {
      isMounted = false;
    };
  }, [selectedAccount, accessToken, onAuthError]);

  // 3. User selects location: location must strictly pass the real Google Business Information API detail request
  const handleSelectLocation = async (loc: GoogleLocation) => {
    if (!selectedAccount) return;
    setError(null);
    setFetchingDetailId(loc.name);

    try {
      const detailed = await GoogleBusinessService.fetchLocationDetail(
        loc.name,
        accessToken
      );
      onLocationSelected(selectedAccount, detailed);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to retrieve location detail from Google Business Information API.';
      setError(msg);
      if (
        msg.includes('401') ||
        msg.includes('403') ||
        msg.toLowerCase().includes('credential') ||
        msg.toLowerCase().includes('unauthenticated')
      ) {
        GoogleBusinessService.clearSession();
        if (onAuthError) {
          onAuthError(msg);
        }
      }
    } finally {
      setFetchingDetailId(null);
    }
  };

  const handleTriggerReauth = () => {
    GoogleBusinessService.clearSession();
    if (onAuthError && error) {
      onAuthError(error);
    } else {
      onCancel();
    }
  };

  const isAuthError = Boolean(
    error && (
      error.toLowerCase().includes('authentication') ||
      error.toLowerCase().includes('unauthenticated') ||
      error.toLowerCase().includes('401') ||
      error.toLowerCase().includes('403') ||
      error.toLowerCase().includes('credential') ||
      error.toLowerCase().includes('token')
    )
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center space-x-2">
              <Building2 className="w-5 h-5 text-emerald-400" />
              <span>Select Authenticated Business Location</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Source of truth: Google Business Profile API v1
            </p>
          </div>
          <button
            onClick={onCancel}
            className="text-xs text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded-lg border border-slate-800 hover:bg-slate-800 transition"
          >
            Cancel
          </button>
        </div>

        {/* Real API Error Alert */}
        {error && (
          <div className="mx-6 mt-4 p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex flex-col space-y-3">
            <div className="flex items-start space-x-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">
                <span className="font-semibold block mb-0.5">Google API Error:</span>
                {error}
              </div>
            </div>

            {isAuthError && (
              <div className="pt-2 border-t border-rose-500/20 flex items-center justify-between">
                <span className="text-[11px] text-rose-300/80">
                  Authentication credential rejected or expired. Please authorize a fresh session.
                </span>
                <button
                  onClick={handleTriggerReauth}
                  className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white font-medium rounded-lg text-xs flex items-center space-x-1"
                >
                  <LogOut className="w-3 h-3" />
                  <span>Re-authenticate</span>
                </button>
              </div>
            )}
          </div>
        )}

        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Real Accounts Switcher (rendered when user manages multiple GBP accounts) */}
          {accounts.length > 1 && (
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Google Business Accounts ({accounts.length})
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {accounts.map((acc) => (
                  <button
                    key={acc.name}
                    onClick={() => setSelectedAccount(acc.name)}
                    className={`p-3 rounded-xl border text-left text-xs transition ${
                      selectedAccount === acc.name
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300'
                        : 'border-slate-800 bg-slate-950/40 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="font-semibold truncate">{acc.accountName || acc.name}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5 capitalize">{acc.type || 'Account'}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Real Locations List */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Locations in Selected Account
              </label>
              {locationsLoading && (
                <span className="flex items-center space-x-1.5 text-xs text-emerald-400">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Loading locations from Google...</span>
                </span>
              )}
            </div>

            {loading ? (
              <div className="py-12 text-center text-slate-400 text-sm">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-emerald-400 mb-2" />
                Connecting to Google Business Account Management API...
              </div>
            ) : locations.length === 0 && !locationsLoading ? (
              <div className="p-8 border border-dashed border-slate-800 rounded-xl text-center">
                <p className="text-sm font-medium text-slate-300">No locations found</p>
                <p className="text-xs text-slate-500 mt-1">
                  This Google account does not manage any active Business Profile locations, or location permissions are pending on Google.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {locations.map((loc) => {
                  const addr = loc.storefrontAddress;
                  const addressStr = [
                    ...(addr?.addressLines || []),
                    addr?.locality,
                    addr?.administrativeArea,
                    addr?.postalCode
                  ].filter(Boolean).join(', ');

                  const category = loc.categories?.primaryCategory?.displayName || loc.categories?.primaryCategory?.name || 'Category not set';
                  const isSelectingThis = fetchingDetailId === loc.name;

                  return (
                    <div
                      key={loc.name}
                      onClick={() => !isSelectingThis && handleSelectLocation(loc)}
                      className={`group p-4 bg-slate-950/50 hover:bg-slate-800/60 border rounded-xl cursor-pointer transition flex items-start justify-between ${
                        isSelectingThis ? 'border-emerald-500 bg-emerald-950/20' : 'border-slate-800 hover:border-emerald-500/50'
                      }`}
                    >
                      <div className="space-y-1 pr-4">
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-white text-sm group-hover:text-emerald-300 transition">
                            {loc.title || 'Untitled Business'}
                          </span>
                          {loc.metadata?.hasVoiceOfMerchant && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              Verified
                            </span>
                          )}
                        </div>

                        <div className="flex items-center space-x-1.5 text-xs text-slate-400">
                          <MapPin className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                          <span className="truncate">{addressStr || 'No storefront address specified'}</span>
                        </div>

                        <div className="flex items-center space-x-3 text-[11px] text-slate-500 pt-1">
                          <span>Category: <strong className="text-slate-400">{category}</strong></span>
                          <span>•</span>
                          <span>Place ID: <code className="text-slate-400">{loc.metadata?.placeId ? loc.metadata.placeId.slice(0, 10) + '...' : 'Pending'}</code></span>
                        </div>
                      </div>

                      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-800 group-hover:bg-emerald-500 group-hover:text-slate-950 text-slate-400 transition self-center flex-shrink-0">
                        {isSelectingThis ? (
                          <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="p-4 bg-slate-950/90 border-t border-slate-800 text-xs text-slate-400 flex items-center justify-between">
          <span>Real Google location selection required to initialize STall.</span>
          <span className="font-mono text-[11px] text-slate-500">API: businessinformation.googleapis.com/v1</span>
        </div>
      </div>
    </div>
  );
};
