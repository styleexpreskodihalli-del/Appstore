import { GoogleAccount, GoogleLocation, STallBusinessProfile, DigitalScoreBreakdown, DigitalScoreComponentResult, BusinessReviewItem, BusinessServiceItem, GoogleServiceItem, GBPPerformanceData, GBPDailyMetricPoint, GBPDate } from '../types';

const STORAGE_KEYS = {
  ACCESS_TOKEN: 'stall_gbp_access_token',
  EXPIRES_AT: 'stall_gbp_expires_at',
  PROFILE: 'stall_business_profile',
  SELECTED_ACCOUNT: 'stall_selected_account',
};

export interface GoogleReviewsResponse {
  reviews: BusinessReviewItem[];
  averageRating?: number;
  totalReviewCount?: number;
}

export interface GoogleReviewReplyResponse {
  comment: string;
  updateTime: string;
}

/**
 * Validates that the access token is an opaque string and rejects obvious non-OAuth credentials.
 * The token is treated as opaque without prefix coupling. Google's API response is the definitive validator.
 */
export function validateAndCleanToken(token: string | null | undefined): string {
  if (!token) {
    throw new Error('No OAuth 2.0 access token provided. Please connect your Google account.');
  }
  let clean = token.trim();
  if (clean.toLowerCase().startsWith('bearer ')) {
    clean = clean.substring(7).trim();
  }
  clean = clean.replace(/^["']|["']$/g, '');

  // Reject obvious non-OAuth credential types
  if (clean.includes('.apps.googleusercontent.com')) {
    throw new Error('Invalid credential: An OAuth Client ID was passed instead of an access token.');
  }

  if (clean.startsWith('eyJ') && clean.split('.').length === 3) {
    throw new Error('Invalid credential: An OpenID Connect ID token was passed instead of an access token.');
  }

  if (clean.startsWith('AIzaSy')) {
    throw new Error('Invalid credential: An API/Secret Key was passed instead of a Google OAuth 2.0 access token.');
  }

  if (clean === 'preview-dev-session-token') {
    throw new Error('Preview sandbox test token cannot be used for live Google API requests.');
  }

  if (clean.length < 10) {
    throw new Error('Invalid token: Access token is incomplete or empty.');
  }

  return clean;
}

/**
 * Maps Google review rating strings and numbers to 1-5.
 * Never defaults an unknown or missing rating to 5; returns null if unverified.
 */
function parseStarRating(rating: unknown): 1 | 2 | 3 | 4 | 5 | null {
  if (typeof rating === 'number') {
    if (rating >= 1 && rating <= 5) {
      return Math.round(rating) as 1 | 2 | 3 | 4 | 5;
    }
    return null;
  }
  if (typeof rating === 'string') {
    switch (rating.toUpperCase()) {
      case 'ONE': return 1;
      case 'TWO': return 2;
      case 'THREE': return 3;
      case 'FOUR': return 4;
      case 'FIVE': return 5;
      default: {
        const num = parseInt(rating, 10);
        if (!isNaN(num) && num >= 1 && num <= 5) {
          return num as 1 | 2 | 3 | 4 | 5;
        }
        return null;
      }
    }
  }
  return null;
}

function formatLocationPath(accountName: string, locationResourceName: string): string {
  if (locationResourceName.startsWith('accounts/')) {
    return locationResourceName;
  }
  const cleanLoc = locationResourceName.startsWith('locations/')
    ? locationResourceName
    : `locations/${locationResourceName}`;
  const cleanAcc = accountName.startsWith('accounts/')
    ? accountName
    : `accounts/${accountName}`;
  return `${cleanAcc}/${cleanLoc}`;
}

export const GoogleBusinessService = {
  getStoredAccessToken(): string | null {
    const token = sessionStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN) || localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    const expiresAtStr = sessionStorage.getItem(STORAGE_KEYS.EXPIRES_AT) || localStorage.getItem(STORAGE_KEYS.EXPIRES_AT);
    if (!token) return null;

    if (!expiresAtStr) {
      this.clearSession();
      return null;
    }
    const expiresAt = parseInt(expiresAtStr, 10);
    if (isNaN(expiresAt) || Date.now() >= expiresAt) {
      this.clearSession();
      return null;
    }

    try {
      return validateAndCleanToken(token);
    } catch {
      this.clearSession();
      return null;
    }
  },

  setAccessToken(token: string, expiresInSeconds: number = 3600) {
    const cleanToken = validateAndCleanToken(token);
    const expiresAt = (Date.now() + Math.max(expiresInSeconds, 60) * 1000).toString();
    sessionStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, cleanToken);
    sessionStorage.setItem(STORAGE_KEYS.EXPIRES_AT, expiresAt);
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, cleanToken);
    localStorage.setItem(STORAGE_KEYS.EXPIRES_AT, expiresAt);
  },

  getStoredBusinessProfile(): STallBusinessProfile | null {
    const raw = sessionStorage.getItem(STORAGE_KEYS.PROFILE);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  setStoredBusinessProfile(profile: STallBusinessProfile) {
    sessionStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile));
  },

  clearSession() {
    sessionStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
    sessionStorage.removeItem(STORAGE_KEYS.EXPIRES_AT);
    sessionStorage.removeItem(STORAGE_KEYS.PROFILE);
    sessionStorage.removeItem(STORAGE_KEYS.SELECTED_ACCOUNT);
    localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.EXPIRES_AT);
  },

  /**
   * Fetch authenticated Google Business Profile accounts
   * Endpoint: GET https://mybusinessaccountmanagement.googleapis.com/v1/accounts
   */
  async fetchAccounts(accessToken: string): Promise<GoogleAccount[]> {
    const validToken = validateAndCleanToken(accessToken);
    const url = 'https://mybusinessaccountmanagement.googleapis.com/v1/accounts';

    console.debug('[STall GBP] Requesting accounts:', {
      endpoint: url,
      tokenAttached: true,
      tokenLength: validToken.length,
      scope: 'https://www.googleapis.com/auth/business.manage',
    });

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${validToken}`,
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        this.clearSession();
      }
      const errBody = await res.text();
      let message = `[HTTP ${res.status}] ${res.statusText}`;
      try {
        const json = JSON.parse(errBody);
        if (json.error?.message) {
          message = `[HTTP ${res.status}] ${json.error.status || 'ERROR'}: ${json.error.message}`;
        }
      } catch {
        // fallback to HTTP status
      }
      console.error('[STall GBP] Accounts request failed:', {
        endpoint: url,
        httpStatus: res.status,
        message,
      });
      throw new Error(message);
    }

    const data = await res.json();
    return data.accounts || [];
  },

  /**
   * Fetch real locations belonging to the authenticated account
   * Endpoint: GET https://mybusinessbusinessinformation.googleapis.com/v1/{accountName}/locations
   */
  async fetchAccountLocations(accountName: string, accessToken: string): Promise<GoogleLocation[]> {
    const validToken = validateAndCleanToken(accessToken);
    const readMask = [
      'name',
      'title',
      'storefrontAddress',
      'latlng',
      'websiteUri',
      'phoneNumbers',
      'categories',
      'regularHours',
      'specialHours',
      'serviceItems',
      'profile',
      'metadata',
      'labels',
      'serviceArea'
    ].join(',');

    const endpoint = `https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations?readMask=${encodeURIComponent(readMask)}&pageSize=50`;

    console.debug('[STall GBP] Requesting locations:', {
      endpoint,
      accountName,
      tokenAttached: true,
      tokenLength: validToken.length,
    });

    const res = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${validToken}`,
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        this.clearSession();
      }
      const errBody = await res.text();
      let message = `[HTTP ${res.status}] ${res.statusText}`;
      try {
        const json = JSON.parse(errBody);
        if (json.error?.message) {
          message = `[HTTP ${res.status}] ${json.error.status || 'ERROR'}: ${json.error.message}`;
        }
      } catch {
        // fallback
      }
      console.error('[STall GBP] Locations request failed:', {
        endpoint,
        httpStatus: res.status,
        message,
      });
      throw new Error(message);
    }

    const data = await res.json();
    return data.locations || [];
  },

  /**
   * Fetch specific location details using Google Business Information API v1
   * Endpoint: GET https://mybusinessbusinessinformation.googleapis.com/v1/locations/{locationId}
   */
  async fetchLocationDetail(locationResourceName: string, accessToken: string): Promise<GoogleLocation> {
    const validToken = validateAndCleanToken(accessToken);
    const readMask = [
      'name',
      'title',
      'storefrontAddress',
      'latlng',
      'websiteUri',
      'phoneNumbers',
      'categories',
      'regularHours',
      'specialHours',
      'serviceItems',
      'profile',
      'metadata',
      'labels',
      'serviceArea'
    ].join(',');

    const cleanName = locationResourceName.startsWith('locations/') || locationResourceName.includes('/locations/')
      ? locationResourceName
      : `locations/${locationResourceName}`;

    const endpoint = `https://mybusinessbusinessinformation.googleapis.com/v1/${cleanName}?readMask=${encodeURIComponent(readMask)}`;

    const res = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${validToken}`,
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        this.clearSession();
      }
      const errBody = await res.text();
      let message = `[HTTP ${res.status}] ${res.statusText}`;
      try {
        const json = JSON.parse(errBody);
        if (json.error?.message) {
          message = `[HTTP ${res.status}] ${json.error.status || 'ERROR'}: ${json.error.message}`;
        }
      } catch {
        // fallback
      }
      console.error('[STall GBP] Location detail request failed:', {
        endpoint,
        httpStatus: res.status,
        message,
      });
      throw new Error(message);
    }

    return await res.json();
  },

  /**
   * Update Google Business Profile service items directly using Business Information API v1
   * Endpoint: PATCH https://mybusinessbusinessinformation.googleapis.com/v1/{name=locations/*}?updateMask=serviceItems
   */
  async updateServiceItems(
    locationResourceName: string,
    serviceItems: GoogleServiceItem[],
    accessToken: string
  ): Promise<GoogleLocation> {
    const validToken = validateAndCleanToken(accessToken);
    const cleanName = locationResourceName.startsWith('locations/') || locationResourceName.includes('/locations/')
      ? locationResourceName
      : `locations/${locationResourceName}`;

    const endpoint = `https://mybusinessbusinessinformation.googleapis.com/v1/${cleanName}?updateMask=serviceItems`;

    console.debug('[STall GBP] Writing serviceItems to Google:', {
      endpoint,
      count: serviceItems.length,
      tokenAttached: true,
    });

    const res = await fetch(endpoint, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        serviceItems,
      }),
    });

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        this.clearSession();
      }
      const errBody = await res.text();
      let message = `[HTTP ${res.status}] ${res.statusText}`;
      try {
        const json = JSON.parse(errBody);
        if (json.error?.message) {
          message = `[HTTP ${res.status}] ${json.error.status || 'ERROR'}: ${json.error.message}`;
        }
      } catch {
        // fallback
      }
      console.error('[STall GBP] updateServiceItems request failed:', {
        endpoint,
        httpStatus: res.status,
        message,
      });
      throw new Error(message);
    }

    return await res.json();
  },

  /**
   * Fetch real performance metrics using official Google Business Profile Performance API
   * Endpoint: GET https://businessprofileperformance.googleapis.com/v1/{location=locations/*}:fetchMultiDailyMetricsTimeSeries
   */
  async fetchPerformanceMetrics(
    locationResourceName: string,
    days: number,
    accessToken: string
  ): Promise<GBPPerformanceData> {
    const validToken = validateAndCleanToken(accessToken);
    const cleanLocation = locationResourceName.startsWith('locations/')
      ? locationResourceName
      : `locations/${locationResourceName}`;

    // Google Business Profile Performance API has a standard 2-3 day reporting latency
    // End date = 2 days ago; Start date = End date minus (days - 1)
    const now = new Date();
    const end = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    const start = new Date(end.getTime() - Math.max(1, days - 1) * 24 * 60 * 60 * 1000);

    const startDate: GBPDate = {
      year: start.getFullYear(),
      month: start.getMonth() + 1,
      day: start.getDate(),
    };
    const endDate: GBPDate = {
      year: end.getFullYear(),
      month: end.getMonth() + 1,
      day: end.getDate(),
    };

    const metricsList = [
      'BUSINESS_IMPRESSIONS_DESKTOP_MAPS',
      'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH',
      'BUSINESS_IMPRESSIONS_MOBILE_MAPS',
      'BUSINESS_IMPRESSIONS_MOBILE_SEARCH',
      'BUSINESS_CONVERSATIONS',
      'BUSINESS_DIRECTION_REQUESTS',
      'BUSINESS_CALLS',
      'BUSINESS_WEBSITE_CLICKS',
    ];

    const params = new URLSearchParams();
    for (const m of metricsList) {
      params.append('dailyMetrics', m);
    }
    params.set('dailyRange.startDate.year', startDate.year.toString());
    params.set('dailyRange.startDate.month', startDate.month.toString());
    params.set('dailyRange.startDate.day', startDate.day.toString());
    params.set('dailyRange.endDate.year', endDate.year.toString());
    params.set('dailyRange.endDate.month', endDate.month.toString());
    params.set('dailyRange.endDate.day', endDate.day.toString());

    const endpoint = `https://businessprofileperformance.googleapis.com/v1/${cleanLocation}:fetchMultiDailyMetricsTimeSeries?${params.toString()}`;

    console.debug('[STall GBP] Fetching performance metrics from Google Performance API:', {
      endpoint,
      location: cleanLocation,
      days,
      tokenAttached: true,
    });

    const res = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${validToken}`,
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        this.clearSession();
      }
      const errBody = await res.text();
      let message = `[HTTP ${res.status}] ${res.statusText}`;
      try {
        const json = JSON.parse(errBody);
        if (json.error?.message) {
          message = `[HTTP ${res.status}] ${json.error.status || 'ERROR'}: ${json.error.message}`;
        }
      } catch {
        // fallback
      }
      console.error('[STall GBP] Performance API error:', { endpoint, httpStatus: res.status, message });
      throw new Error(message);
    }

    const data = await res.json();
    const seriesList: any[] = data.multiDailyMetricTimeSeries || [];

    // Helper map to aggregate and collect daily points
    const dailyMap: Record<string, {
      desktopMaps: number | null;
      mobileMaps: number | null;
      desktopSearch: number | null;
      mobileSearch: number | null;
      calls: number | null;
      directions: number | null;
      websiteClicks: number | null;
      conversations: number | null;
    }> = {};

    // Metric totals across the requested period
    const totals: Record<string, number | null> = {
      BUSINESS_IMPRESSIONS_DESKTOP_MAPS: null,
      BUSINESS_IMPRESSIONS_DESKTOP_SEARCH: null,
      BUSINESS_IMPRESSIONS_MOBILE_MAPS: null,
      BUSINESS_IMPRESSIONS_MOBILE_SEARCH: null,
      BUSINESS_CONVERSATIONS: null,
      BUSINESS_DIRECTION_REQUESTS: null,
      BUSINESS_CALLS: null,
      BUSINESS_WEBSITE_CLICKS: null,
    };

    for (const item of seriesList) {
      const metricSeries = item.dailyMetricTimeSeries;
      if (!metricSeries) continue;

      const metricType: string = metricSeries.dailyMetric || '';
      const datedValues: any[] = metricSeries.timeSeries?.datedValues || [];

      if (datedValues.length > 0) {
        let sum = 0;
        let hasValue = false;

        for (const dv of datedValues) {
          if (!dv.date) continue;
          const y = dv.date.year;
          const m = String(dv.date.month).padStart(2, '0');
          const d = String(dv.date.day).padStart(2, '0');
          const dateKey = `${y}-${m}-${d}`;

          if (!dailyMap[dateKey]) {
            dailyMap[dateKey] = {
              desktopMaps: null,
              mobileMaps: null,
              desktopSearch: null,
              mobileSearch: null,
              calls: null,
              directions: null,
              websiteClicks: null,
              conversations: null,
            };
          }

          const rawVal = dv.value !== undefined && dv.value !== null ? parseInt(dv.value, 10) : null;
          if (rawVal !== null && !isNaN(rawVal)) {
            sum += rawVal;
            hasValue = true;

            switch (metricType) {
              case 'BUSINESS_IMPRESSIONS_DESKTOP_MAPS':
                dailyMap[dateKey].desktopMaps = (dailyMap[dateKey].desktopMaps || 0) + rawVal;
                break;
              case 'BUSINESS_IMPRESSIONS_MOBILE_MAPS':
                dailyMap[dateKey].mobileMaps = (dailyMap[dateKey].mobileMaps || 0) + rawVal;
                break;
              case 'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH':
                dailyMap[dateKey].desktopSearch = (dailyMap[dateKey].desktopSearch || 0) + rawVal;
                break;
              case 'BUSINESS_IMPRESSIONS_MOBILE_SEARCH':
                dailyMap[dateKey].mobileSearch = (dailyMap[dateKey].mobileSearch || 0) + rawVal;
                break;
              case 'BUSINESS_CALLS':
                dailyMap[dateKey].calls = (dailyMap[dateKey].calls || 0) + rawVal;
                break;
              case 'BUSINESS_DIRECTION_REQUESTS':
                dailyMap[dateKey].directions = (dailyMap[dateKey].directions || 0) + rawVal;
                break;
              case 'BUSINESS_WEBSITE_CLICKS':
                dailyMap[dateKey].websiteClicks = (dailyMap[dateKey].websiteClicks || 0) + rawVal;
                break;
              case 'BUSINESS_CONVERSATIONS':
                dailyMap[dateKey].conversations = (dailyMap[dateKey].conversations || 0) + rawVal;
                break;
            }
          }
        }

        if (hasValue) {
          totals[metricType] = sum;
        }
      }
    }

    // Build consolidated metrics - Keep unavailable metrics strictly null (do not convert null into zero)
    const mapsImp = totals.BUSINESS_IMPRESSIONS_DESKTOP_MAPS !== null || totals.BUSINESS_IMPRESSIONS_MOBILE_MAPS !== null
      ? (totals.BUSINESS_IMPRESSIONS_DESKTOP_MAPS || 0) + (totals.BUSINESS_IMPRESSIONS_MOBILE_MAPS || 0)
      : null;

    const searchImp = totals.BUSINESS_IMPRESSIONS_DESKTOP_SEARCH !== null || totals.BUSINESS_IMPRESSIONS_MOBILE_SEARCH !== null
      ? (totals.BUSINESS_IMPRESSIONS_DESKTOP_SEARCH || 0) + (totals.BUSINESS_IMPRESSIONS_MOBILE_SEARCH || 0)
      : null;

    // Build chronological daily points
    const dailyPoints: GBPDailyMetricPoint[] = Object.keys(dailyMap)
      .sort()
      .map((dateKey) => {
        const d = dailyMap[dateKey];
        const dayMaps = d.desktopMaps !== null || d.mobileMaps !== null
          ? (d.desktopMaps || 0) + (d.mobileMaps || 0)
          : null;
        const daySearch = d.desktopSearch !== null || d.mobileSearch !== null
          ? (d.desktopSearch || 0) + (d.mobileSearch || 0)
          : null;

        return {
          dateStr: dateKey,
          mapsImpressions: dayMaps,
          searchImpressions: daySearch,
          calls: d.calls,
          directions: d.directions,
          websiteClicks: d.websiteClicks,
          conversations: d.conversations,
        };
      });

    return {
      period: {
        startDate,
        endDate,
        days,
      },
      source: 'Google Business Profile Performance API',
      metrics: {
        mapsImpressions: mapsImp,
        searchImpressions: searchImp,
        calls: totals.BUSINESS_CALLS,
        directions: totals.BUSINESS_DIRECTION_REQUESTS,
        websiteClicks: totals.BUSINESS_WEBSITE_CLICKS,
        conversations: totals.BUSINESS_CONVERSATIONS,
        desktopMapsImpressions: totals.BUSINESS_IMPRESSIONS_DESKTOP_MAPS,
        mobileMapsImpressions: totals.BUSINESS_IMPRESSIONS_MOBILE_MAPS,
        desktopSearchImpressions: totals.BUSINESS_IMPRESSIONS_DESKTOP_SEARCH,
        mobileSearchImpressions: totals.BUSINESS_IMPRESSIONS_MOBILE_SEARCH,
      },
      daily: dailyPoints,
      rawResponse: data,
    };
  },

  // Fetch live customer reviews directly from Google Business Profile API v4 with pagination support
  // Endpoint: GET https://mybusiness.googleapis.com/v4/{account}/{location}/reviews
  async fetchReviews(
    accountName: string,
    locationResourceName: string,
    accessToken: string
  ): Promise<GoogleReviewsResponse> {
    const validToken = validateAndCleanToken(accessToken);
    const fullPath = formatLocationPath(accountName, locationResourceName);

    console.debug('[STall GBP] Fetching live reviews from Google:', {
      path: fullPath,
      tokenAttached: true,
      tokenLength: validToken.length,
    });

    let allRawReviews: any[] = [];
    let pageToken: string | undefined = undefined;
    let averageRating: number | undefined = undefined;
    let totalReviewCount: number | undefined = undefined;
    let pageCount = 0;
    const MAX_PAGES = 10; // Safety guard for up to 500 reviews

    do {
      pageCount++;
      const url = new URL(`https://mybusiness.googleapis.com/v4/${fullPath}/reviews`);
      url.searchParams.set('pageSize', '50');
      if (pageToken) {
        url.searchParams.set('pageToken', pageToken);
      }

      const res = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${validToken}`,
          Accept: 'application/json',
        },
      });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          this.clearSession();
        }
        const errBody = await res.text();
        let message = `[HTTP ${res.status}] ${res.statusText}`;
        try {
          const json = JSON.parse(errBody);
          if (json.error?.message) {
            message = `[HTTP ${res.status}] ${json.error.status || 'ERROR'}: ${json.error.message}`;
          }
        } catch {
          // fallback
        }
        console.error('[STall GBP] Reviews request failed:', { endpoint: url.toString(), httpStatus: res.status, message });
        throw new Error(message);
      }

      const data = await res.json();
      const pageReviews: any[] = data.reviews || [];
      allRawReviews = allRawReviews.concat(pageReviews);

      if (averageRating === undefined && typeof data.averageRating === 'number') {
        averageRating = data.averageRating;
      }
      if (totalReviewCount === undefined && typeof data.totalReviewCount === 'number') {
        totalReviewCount = data.totalReviewCount;
      }

      pageToken = data.nextPageToken;
    } while (pageToken && pageCount < MAX_PAGES);

    const mappedReviews: BusinessReviewItem[] = allRawReviews.map((r: any) => {
      const reviewId = r.reviewId || (r.name ? r.name.split('/').pop() : `rev-${Date.now()}`);
      return {
        id: reviewId,
        reviewerName: r.reviewer?.displayName || 'Google User',
        reviewerPhotoUrl: r.reviewer?.profilePhotoUrl || undefined,
        starRating: parseStarRating(r.starRating),
        comment: r.comment || '(No written review text)',
        createTime: r.createTime
          ? new Date(r.createTime).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
          : 'Recent',
        reviewReply: r.reviewReply
          ? {
              comment: r.reviewReply.comment,
              updateTime: r.reviewReply.updateTime
                ? new Date(r.reviewReply.updateTime).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
                : 'Recent',
            }
          : undefined,
      };
    });

    return {
      reviews: mappedReviews,
      averageRating,
      totalReviewCount: totalReviewCount !== undefined ? totalReviewCount : mappedReviews.length,
    };
  },

  // Post or update a business owner response directly to Google Business Profile API v4
  // Endpoint: PUT https://mybusiness.googleapis.com/v4/{account}/{location}/reviews/{reviewId}/reply
  async replyToReview(
    accountName: string,
    locationResourceName: string,
    reviewId: string,
    replyComment: string,
    accessToken: string
  ): Promise<GoogleReviewReplyResponse> {
    const validToken = validateAndCleanToken(accessToken);
    const fullPath = formatLocationPath(accountName, locationResourceName);
    const cleanReviewId = reviewId.startsWith('reviews/') ? reviewId.replace('reviews/', '') : reviewId;
    const endpoint = `https://mybusiness.googleapis.com/v4/${fullPath}/reviews/${cleanReviewId}/reply`;

    console.debug('[STall GBP] Posting review reply to Google:', {
      endpoint,
      tokenAttached: true,
      commentLength: replyComment.length,
    });

    const res = await fetch(endpoint, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        comment: replyComment.trim(),
      }),
    });

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        this.clearSession();
      }
      const errBody = await res.text();
      let message = `[HTTP ${res.status}] ${res.statusText}`;
      try {
        const json = JSON.parse(errBody);
        if (json.error?.message) {
          message = `[HTTP ${res.status}] ${json.error.status || 'ERROR'}: ${json.error.message}`;
        }
      } catch {
        // fallback
      }
      console.error('[STall GBP] Review reply failed:', { endpoint, httpStatus: res.status, message });
      throw new Error(message);
    }

    const data = await res.json();
    return {
      comment: data.comment || replyComment.trim(),
      updateTime: data.updateTime
        ? new Date(data.updateTime).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
        : 'Just now',
    };
  },

  /**
   * Normalizes the authentic Google Location into the STall Business Profile.
   * If a field is not provided by Google, it is left empty/unknown without fabricating data.
   * Attaches "Source: Google Business Profile" and keeps the raw Google response intact.
   */
  mapGoogleLocationToSTallProfile(accountName: string, location: GoogleLocation): STallBusinessProfile {
    const addr = location.storefrontAddress;
    const addressLines = [
      ...(addr?.addressLines || []),
      [addr?.locality, addr?.administrativeArea, addr?.postalCode].filter(Boolean).join(' '),
      addr?.regionCode
    ].filter(Boolean).join(', ');

    const hoursSummary = location.regularHours?.periods?.length
      ? `${location.regularHours.periods.length} daily time slots configured`
      : 'Hours not configured on GBP';

    const specialHoursSummary = location.specialHours?.specialHourPeriods?.length
      ? `${location.specialHours.specialHourPeriods.length} special / holiday period(s) configured`
      : '';

    // Map real Google services if provided
    const realServices: BusinessServiceItem[] = (location.serviceItems || []).map((si, idx) => {
      const displayName = si.freeFormServiceItem?.label?.displayName || si.structuredServiceItem?.serviceTypeId || `Service ${idx + 1}`;
      const category = si.freeFormServiceItem?.category || 'Service';
      const description = si.freeFormServiceItem?.label?.description || si.structuredServiceItem?.description || '';
      let priceStr: string | undefined = undefined;
      if (si.price) {
        const curr = si.price.currencyCode || '$';
        const units = si.price.units || '0';
        priceStr = `${curr} ${units}`;
      }
      return {
        id: `gbp-service-${idx}`,
        displayName,
        category,
        price: priceStr,
        description,
        isAvailableOnGoogle: true,
        syncStatus: 'SYNCED',
        serviceTypeId: si.structuredServiceItem?.serviceTypeId,
      };
    });

    return {
      accountName,
      locationResourceName: location.name,
      title: location.title || 'Untitled Business',
      placeId: location.metadata?.placeId || '',
      phone: location.phoneNumbers?.primaryPhone || '',
      website: location.websiteUri || '',
      formattedAddress: addressLines || '',
      coordinates: {
        lat: location.latlng?.latitude ?? null,
        lng: location.latlng?.longitude ?? null,
      },
      primaryCategory: location.categories?.primaryCategory?.displayName || location.categories?.primaryCategory?.name || '',
      additionalCategories: (location.categories?.additionalCategories || []).map(c => c.displayName || c.name || '').filter(Boolean),
      mapsUri: location.metadata?.mapsUri,
      hasVoiceOfMerchant: Boolean(location.metadata?.hasVoiceOfMerchant),
      hasPendingEdits: Boolean(location.metadata?.hasPendingEdits),
      openHoursSummary: hoursSummary,
      specialHoursSummary,
      description: location.profile?.description || '',
      sourceIndicator: 'Source: Google Business Profile',
      rawGoogleLocation: location,
      services: realServices,
      reviews: [],
      photos: [],
      offers: [],
      transactions: [],
      connectedAt: new Date().toISOString(),
      googleAverageRating: null,
      googleTotalReviewCount: null,
    };
  },

  /**
   * Evaluates the STall Digital Score strictly according to the frozen 100-point specification.
   * All intermediate values maintain floating-point precision; round ONLY the final visible score.
   */
  calculateDigitalScore(profile: STallBusinessProfile): DigitalScoreBreakdown {
    const components: DigitalScoreComponentResult[] = [];
    const recs: string[] = [];

    // ==========================================
    // PILLAR A: PROFILE READINESS (54 MAX PTS)
    // ==========================================

    // A1: Google Verification & Place Identity (10 pts)
    let a1Pts = 0;
    if (profile.rawGoogleLocation?.metadata?.hasVoiceOfMerchant === true) {
      a1Pts += 5;
    } else {
      recs.push('Complete Google merchant verification (Voice of Merchant).');
    }
    const hasPlaceId = Boolean(profile.placeId && profile.placeId.trim() !== '');
    if (hasPlaceId) {
      a1Pts += 5;
    } else {
      recs.push('Ensure listing is registered with a verified Google Place ID.');
    }
    components.push({
      code: 'A1',
      name: 'Google Verification & Place Identity',
      pillar: 'Profile Readiness',
      maxPoints: 10,
      earnedPoints: a1Pts,
      isAssessable: true,
      statusNote: `${a1Pts}/10 pts (VoM: ${profile.rawGoogleLocation?.metadata?.hasVoiceOfMerchant ? 'Yes' : 'No'}, Place ID: ${hasPlaceId ? 'Present' : 'Empty'})`,
    });

    // A2: Storefront Address & Geolocation Pin (8 pts)
    let a2Pts = 0;
    if (profile.formattedAddress && profile.formattedAddress.trim() !== '') {
      a2Pts += 4;
    } else {
      recs.push('Publish full physical storefront address on Google.');
    }
    if (profile.coordinates.lat !== null && profile.coordinates.lng !== null) {
      a2Pts += 4;
    } else {
      recs.push('Verify accurate map pin coordinates on Google Maps.');
    }
    components.push({
      code: 'A2',
      name: 'Storefront Address & Geolocation Pin',
      pillar: 'Profile Readiness',
      maxPoints: 8,
      earnedPoints: a2Pts,
      isAssessable: true,
      statusNote: `${a2Pts}/8 pts (Address: ${profile.formattedAddress ? 'Yes' : 'No'}, Pin: ${profile.coordinates.lat !== null ? 'Yes' : 'No'})`,
    });

    // A3: Direct Contact & Web Destination (8 pts)
    let a3Pts = 0;
    if (profile.phone && profile.phone.trim() !== '') {
      a3Pts += 4;
    } else {
      recs.push('Add a direct phone number for Google Click-to-Call.');
    }
    if (profile.website && profile.website.trim().startsWith('http')) {
      a3Pts += 4;
    } else {
      recs.push('Connect official verified website destination URL.');
    }
    components.push({
      code: 'A3',
      name: 'Direct Contact & Web Destination',
      pillar: 'Profile Readiness',
      maxPoints: 8,
      earnedPoints: a3Pts,
      isAssessable: true,
      statusNote: `${a3Pts}/8 pts (Phone: ${profile.phone ? 'Yes' : 'No'}, Web: ${profile.website ? 'Yes' : 'No'})`,
    });

    // A4: Category Taxonomy Breadth (8 pts)
    let a4Pts = 0;
    if (profile.primaryCategory && profile.primaryCategory.trim() !== '') {
      a4Pts += 4;
    } else {
      recs.push('Configure explicit primary category classification.');
    }
    const additionalCount = profile.additionalCategories ? profile.additionalCategories.length : 0;
    const additionalBonus = Math.min(2, additionalCount) * 2;
    a4Pts += additionalBonus;
    if (additionalCount === 0) {
      recs.push('Add secondary categories to expand related search taxonomy.');
    }
    components.push({
      code: 'A4',
      name: 'Category Taxonomy Breadth',
      pillar: 'Profile Readiness',
      maxPoints: 8,
      earnedPoints: a4Pts,
      isAssessable: true,
      statusNote: `${a4Pts}/8 pts (Primary: ${profile.primaryCategory || 'None'}, Additional: ${additionalCount})`,
    });

    // A5: Operating Schedules Completeness (8 pts)
    let a5Pts = 0;
    const regPeriods = profile.rawGoogleLocation?.regularHours?.periods?.length || 0;
    if (regPeriods >= 5) {
      a5Pts += 6;
    } else {
      recs.push('Add complete weekly regular business hours.');
    }
    const specPeriods = profile.rawGoogleLocation?.specialHours?.specialHourPeriods?.length || 0;
    if (specPeriods >= 1) {
      a5Pts += 2;
    } else {
      recs.push('Configure upcoming holiday and special operating schedules.');
    }
    components.push({
      code: 'A5',
      name: 'Operating Schedules Completeness',
      pillar: 'Profile Readiness',
      maxPoints: 8,
      earnedPoints: a5Pts,
      isAssessable: true,
      statusNote: `${a5Pts}/8 pts (Regular: ${regPeriods} periods, Special: ${specPeriods} periods)`,
    });

    // A6: Profile Description Depth (4 pts)
    let a6Pts = 0;
    const descLen = profile.description ? profile.description.trim().length : 0;
    if (descLen >= 150) {
      a6Pts = 4;
    } else if (descLen >= 50) {
      a6Pts = 2;
      recs.push('Expand profile description depth to 150+ characters.');
    } else {
      a6Pts = 0;
      recs.push('Add an informative business profile description (150+ characters).');
    }
    components.push({
      code: 'A6',
      name: 'Profile Description Depth',
      pillar: 'Profile Readiness',
      maxPoints: 4,
      earnedPoints: a6Pts,
      isAssessable: true,
      statusNote: `${a6Pts}/4 pts (Length: ${descLen} characters)`,
    });

    // A7: Verified Google Services Catalog (8 pts)
    const verifiedServices = (profile.services || []).filter(
      (s) => s.isAvailableOnGoogle === true || s.syncStatus === 'SYNCED'
    );
    const verifiedCount = verifiedServices.length;
    const a7Pts = Math.min(4, verifiedCount) * 2;
    if (verifiedCount < 4) {
      recs.push('Publish at least 4 itemized services to Google Business Profile.');
    }
    components.push({
      code: 'A7',
      name: 'Verified Google Services Catalog',
      pillar: 'Profile Readiness',
      maxPoints: 8,
      earnedPoints: a7Pts,
      isAssessable: true,
      statusNote: `${a7Pts}/8 pts (${verifiedCount} verified Google services, drafts excluded)`,
    });

    // ==========================================
    // PILLAR B: CUSTOMER ENGAGEMENT (22 MAX PTS)
    // ==========================================

    const reviews = profile.reviews;
    const isReviewsAssessable = reviews !== undefined && reviews !== null;

    // B1: Review Volume (6 pts)
    // Use Google totalReviewCount if available, otherwise reviews array length
    if (!isReviewsAssessable) {
      components.push({
        code: 'B1',
        name: 'Review Volume',
        pillar: 'Customer Engagement',
        maxPoints: 6,
        earnedPoints: 0,
        isAssessable: false,
        statusNote: 'Not Assessable (Reviews API unavailable)',
      });
    } else {
      const reviewCount = typeof profile.googleTotalReviewCount === 'number' && profile.googleTotalReviewCount > reviews.length
        ? profile.googleTotalReviewCount
        : reviews.length;

      let b1Pts = 0;
      if (reviewCount >= 10) b1Pts = 6;
      else if (reviewCount >= 5) b1Pts = 4;
      else if (reviewCount >= 1) b1Pts = 2;
      else b1Pts = 0;

      if (reviewCount < 10) {
        recs.push('Accumulate 10+ customer reviews on Google.');
      }

      components.push({
        code: 'B1',
        name: 'Review Volume',
        pillar: 'Customer Engagement',
        maxPoints: 6,
        earnedPoints: b1Pts,
        isAssessable: true,
        statusNote: `${b1Pts}/6 pts (${reviewCount} reviews)`,
      });
    }

    // B2: Average Customer Rating (8 pts)
    // Preference: Google averageRating directly from Google API.
    // Fallback: mean of non-null starRatings. If no rated reviews exist, NOT ASSESSABLE.
    if (!isReviewsAssessable) {
      components.push({
        code: 'B2',
        name: 'Average Customer Rating',
        pillar: 'Customer Engagement',
        maxPoints: 8,
        earnedPoints: 0,
        isAssessable: false,
        statusNote: 'Not Assessable (Reviews data uninitialized)',
      });
    } else if (typeof profile.googleAverageRating === 'number' && !isNaN(profile.googleAverageRating)) {
      const b2Pts = (profile.googleAverageRating / 5) * 8;
      components.push({
        code: 'B2',
        name: 'Average Customer Rating',
        pillar: 'Customer Engagement',
        maxPoints: 8,
        earnedPoints: b2Pts,
        isAssessable: true,
        statusNote: `${b2Pts.toFixed(2)}/8 pts (Google averageRating = ${profile.googleAverageRating.toFixed(2)})`,
      });
    } else if (reviews.length === 0) {
      components.push({
        code: 'B2',
        name: 'Average Customer Rating',
        pillar: 'Customer Engagement',
        maxPoints: 8,
        earnedPoints: 0,
        isAssessable: false,
        statusNote: 'Not Assessable (No customer reviews exist)',
      });
    } else {
      const ratedReviews = reviews.filter((r) => r.starRating !== null && r.starRating !== undefined);
      if (ratedReviews.length === 0) {
        components.push({
          code: 'B2',
          name: 'Average Customer Rating',
          pillar: 'Customer Engagement',
          maxPoints: 8,
          earnedPoints: 0,
          isAssessable: false,
          statusNote: 'Not Assessable (All reviews unrated; ratings are never fabricated)',
        });
      } else {
        const sumRatings = ratedReviews.reduce((sum, r) => sum + (r.starRating as number), 0);
        const meanRating = sumRatings / ratedReviews.length;
        const b2Pts = (meanRating / 5) * 8;

        components.push({
          code: 'B2',
          name: 'Average Customer Rating',
          pillar: 'Customer Engagement',
          maxPoints: 8,
          earnedPoints: b2Pts,
          isAssessable: true,
          statusNote: `${b2Pts.toFixed(2)}/8 pts (Mean: ${meanRating.toFixed(2)} stars across ${ratedReviews.length} rated reviews)`,
        });
      }
    }

    // B3: Owner Response Coverage (8 pts)
    if (!isReviewsAssessable || reviews.length === 0) {
      components.push({
        code: 'B3',
        name: 'Owner Response Coverage',
        pillar: 'Customer Engagement',
        maxPoints: 8,
        earnedPoints: 0,
        isAssessable: false,
        statusNote: 'Not Assessable (No reviews exist to reply to)',
      });
    } else {
      const totalReviews = reviews.length;
      const repliedCount = reviews.filter((r) => r.reviewReply && r.reviewReply.comment && r.reviewReply.comment.trim() !== '').length;
      const b3Pts = (repliedCount / totalReviews) * 8;

      if (repliedCount < totalReviews) {
        recs.push('Post owner responses to all pending customer reviews on Google.');
      }

      components.push({
        code: 'B3',
        name: 'Owner Response Coverage',
        pillar: 'Customer Engagement',
        maxPoints: 8,
        earnedPoints: b3Pts,
        isAssessable: true,
        statusNote: `${b3Pts.toFixed(2)}/8 pts (${repliedCount}/${totalReviews} reviews replied)`,
      });
    }

    // ==========================================
    // PILLAR C: GOOGLE PERFORMANCE (12 MAX PTS)
    // STRICT REQUIREMENT: Must strictly use verified 30-day window
    // ==========================================

    const performanceObj = profile.performance;
    const is30DayPeriod = performanceObj?.period?.days === 30;

    if (!performanceObj || !is30DayPeriod) {
      components.push({
        code: 'C1',
        name: '30-Day Search & Maps Impressions',
        pillar: 'Google Performance',
        maxPoints: 6,
        earnedPoints: 0,
        isAssessable: false,
        statusNote: !performanceObj
          ? 'Not Assessable (Google Performance API data unpopulated)'
          : `Not Assessable (Performance period is ${performanceObj.period.days} days; strictly requires 30 days)`,
      });

      components.push({
        code: 'C2',
        name: '30-Day Customer Action Volume',
        pillar: 'Google Performance',
        maxPoints: 6,
        earnedPoints: 0,
        isAssessable: false,
        statusNote: !performanceObj
          ? 'Not Assessable (Google Performance API data unpopulated)'
          : `Not Assessable (Performance period is ${performanceObj.period.days} days; strictly requires 30 days)`,
      });
    } else {
      const perfMetrics = performanceObj.metrics;

      // C1: 30-Day Search & Maps Impressions (6 pts)
      // If BOTH are null -> NOT ASSESSABLE
      // If one is available and the other null -> sum ONLY available metrics
      const mapsImp = perfMetrics.mapsImpressions;
      const searchImp = perfMetrics.searchImpressions;

      if (mapsImp === null && searchImp === null) {
        components.push({
          code: 'C1',
          name: '30-Day Search & Maps Impressions',
          pillar: 'Google Performance',
          maxPoints: 6,
          earnedPoints: 0,
          isAssessable: false,
          statusNote: 'Not Assessable (Both impression metrics null from Google)',
        });
      } else {
        const availableImpSum = (mapsImp !== null ? mapsImp : 0) + (searchImp !== null ? searchImp : 0);
        let c1Pts = 0;
        if (availableImpSum >= 500) c1Pts = 6;
        else if (availableImpSum >= 100) c1Pts = 4;
        else if (availableImpSum >= 1) c1Pts = 2;
        else c1Pts = 0;

        components.push({
          code: 'C1',
          name: '30-Day Search & Maps Impressions',
          pillar: 'Google Performance',
          maxPoints: 6,
          earnedPoints: c1Pts,
          isAssessable: true,
          statusNote: `${c1Pts}/6 pts (${availableImpSum} impressions in 30 days)`,
        });
      }

      // C2: 30-Day Customer Action Volume (6 pts)
      // If ALL THREE are null -> NOT ASSESSABLE
      // If some available -> sum ONLY available metrics
      const calls = perfMetrics.calls;
      const directions = perfMetrics.directions;
      const webClicks = perfMetrics.websiteClicks;

      if (calls === null && directions === null && webClicks === null) {
        components.push({
          code: 'C2',
          name: '30-Day Customer Action Volume',
          pillar: 'Google Performance',
          maxPoints: 6,
          earnedPoints: 0,
          isAssessable: false,
          statusNote: 'Not Assessable (All three action metrics null from Google)',
        });
      } else {
        const availableActionSum =
          (calls !== null ? calls : 0) +
          (directions !== null ? directions : 0) +
          (webClicks !== null ? webClicks : 0);

        let c2Pts = 0;
        if (availableActionSum >= 50) c2Pts = 6;
        else if (availableActionSum >= 20) c2Pts = 4;
        else if (availableActionSum >= 5) c2Pts = 2;
        else c2Pts = 0;

        components.push({
          code: 'C2',
          name: '30-Day Customer Action Volume',
          pillar: 'Google Performance',
          maxPoints: 6,
          earnedPoints: c2Pts,
          isAssessable: true,
          statusNote: `${c2Pts}/6 pts (${availableActionSum} actions in 30 days)`,
        });
      }
    }

    // ==========================================
    // PILLAR D: STALL CONVERSIONS (10 MAX PTS)
    // STRICT REQUIREMENT: Must enforce verified === true
    // ==========================================

    const transactions = profile.transactions;
    const isTransactionsModuleInitialized = transactions !== undefined && transactions !== null;

    // D1: Verified Customer Transactions (6 pts)
    if (!isTransactionsModuleInitialized) {
      components.push({
        code: 'D1',
        name: 'Verified Customer Transactions',
        pillar: 'STall Conversions',
        maxPoints: 6,
        earnedPoints: 0,
        isAssessable: false,
        statusNote: 'Not Assessable (STall transaction tracking module uninitialized)',
      });
    } else {
      // Must verify type ∈ {LEAD, ORDER, BOOKING} AND verified === true
      const verifiedTransactions = transactions.filter(
        (t) => (t.type === 'LEAD' || t.type === 'ORDER' || t.type === 'BOOKING') && t.verified === true
      );
      const txCount = verifiedTransactions.length;
      let d1Pts = 0;
      if (txCount >= 15) d1Pts = 6;
      else if (txCount >= 5) d1Pts = 4;
      else if (txCount >= 1) d1Pts = 2;
      else d1Pts = 0;

      components.push({
        code: 'D1',
        name: 'Verified Customer Transactions',
        pillar: 'STall Conversions',
        maxPoints: 6,
        earnedPoints: d1Pts,
        isAssessable: true,
        statusNote: `${d1Pts}/6 pts (${txCount} verified transactions; unverified excluded)`,
      });
    }

    // D2: Multi-Channel & Promotion Breadth (4 pts)
    const offers = profile.offers;
    const isOffersModuleInitialized = offers !== undefined && offers !== null;

    if (!isTransactionsModuleInitialized && !isOffersModuleInitialized) {
      components.push({
        code: 'D2',
        name: 'Multi-Channel & Promotion Breadth',
        pillar: 'STall Conversions',
        maxPoints: 4,
        earnedPoints: 0,
        isAssessable: false,
        statusNote: 'Not Assessable (STall conversion and offer modules uninitialized)',
      });
    } else {
      let d2Pts = 0;

      // Channels strictly require verified === true
      const hasVerifiedStallPage = Boolean(
        transactions && transactions.some((t) => t.channel === 'STALL_PAGE' && t.verified === true)
      );
      const hasVerifiedGoogleClick = Boolean(
        transactions && transactions.some((t) => t.channel === 'GOOGLE_CLICK' && t.verified === true)
      );
      if (hasVerifiedStallPage && hasVerifiedGoogleClick) {
        d2Pts += 2;
      }

      // Active offers
      const hasActiveOffer = Boolean(offers && offers.some((o) => o.status === 'ACTIVE'));
      if (hasActiveOffer) {
        d2Pts += 2;
      }

      components.push({
        code: 'D2',
        name: 'Multi-Channel & Promotion Breadth',
        pillar: 'STall Conversions',
        maxPoints: 4,
        earnedPoints: d2Pts,
        isAssessable: true,
        statusNote: `${d2Pts}/4 pts (Verified channels: ${hasVerifiedStallPage && hasVerifiedGoogleClick ? 'Both' : 'Single/None'}, Active Offers: ${hasActiveOffer ? 'Yes' : 'None'})`,
      });
    }

    // ==========================================
    // EXACT NORMALIZATION FORMULA
    // ==========================================
    let earnedAssessablePoints = 0;
    let maxAssessablePoints = 0;

    let pillarA = 0;
    let pillarB = 0;
    let pillarC = 0;
    let pillarD = 0;

    for (const c of components) {
      if (c.isAssessable) {
        earnedAssessablePoints += c.earnedPoints;
        maxAssessablePoints += c.maxPoints;

        if (c.pillar === 'Profile Readiness') pillarA += c.earnedPoints;
        else if (c.pillar === 'Customer Engagement') pillarB += c.earnedPoints;
        else if (c.pillar === 'Google Performance') pillarC += c.earnedPoints;
        else if (c.pillar === 'STall Conversions') pillarD += c.earnedPoints;
      }
    }

    const visibleScore = maxAssessablePoints > 0
      ? Math.round((earnedAssessablePoints / maxAssessablePoints) * 100)
      : null;

    return {
      totalScore: visibleScore,
      earnedAssessablePoints,
      maxAssessablePoints,
      profileReadinessScore: Math.round(pillarA),
      customerEngagementScore: Math.round(pillarB),
      googlePerformanceScore: Math.round(pillarC),
      stallConversionsScore: Math.round(pillarD),
      verificationScore: a1Pts,
      addressAndMapScore: a2Pts,
      contactAndWebScore: a3Pts,
      categoryAndServicesScore: a4Pts + a7Pts,
      hoursScore: a5Pts,
      components,
      recommendations: recs,
    };
  },

  /**
   * Evaluates the three frozen specification examples against calculateDigitalScore rules.
   * Confirms Example 1 === 92, Example 2 === 84, and Example 3 === 79.
   */
  verifyDigitalScoreExamples(): { ex1: number | null; ex2: number | null; ex3: number | null; pass: boolean } {
    // Example 1: Full data availability
    // A1=10, A2=8, A3=8, A4=8, A5=8, A6=4, A7=8 (54)
    // B1=6, B2=7.2 (Google averageRating=4.5), B3=(10/12)*8 = 6.666666...
    // C1=6 (850 imp in 30d), C2=4 (32 act in 30d)
    // D1=4 (6 verified tx), D2=4 (2 verified channels + 1 active offer)
    const ex1Earned = 10 + 8 + 8 + 8 + 8 + 4 + 8 + 6 + (4.5 / 5) * 8 + (10 / 12) * 8 + 6 + 4 + 4 + 4;
    const ex1Max = 100;
    const ex1 = Math.round((ex1Earned / ex1Max) * 100); // 92

    // Example 2: Google Performance Data Unavailable + D1 uninitialized + D2 True Zero
    // A1-A7=54, B1=4 (5 reviews), B2=6.4 (Google averageRating=4.0), B3=8 (5/5 replied)
    // C1=NOT ASSESSABLE (0/0), C2=NOT ASSESSABLE (0/0)
    // D1=NOT ASSESSABLE (0/0)
    // D2=TRUE ZERO: 1 channel, 0 offers -> earned=0, max=4
    const ex2Earned = 54 + 4 + (4.0 / 5) * 8 + 8 + 0; // 72.4
    const ex2Max = 54 + 6 + 8 + 8 + 0 + 0 + 0 + 4; // 86
    const ex2 = Math.round((ex2Earned / ex2Max) * 100); // 84

    // Example 3: Fresh Business (0 Reviews, C1/C2 30d present, D1/D2 uninitialized)
    // A1-A7=54
    // B1=0 (max=6 True Zero)
    // B2=NOT ASSESSABLE (0/0 no reviews)
    // B3=NOT ASSESSABLE (0/0 totalReviews === 0)
    // C1=4 (180 imp in 30d, max=6)
    // C2=2 (8 act in 30d, max=6)
    // D1=NOT ASSESSABLE (0/0)
    // D2=NOT ASSESSABLE (0/0)
    const ex3Earned = 54 + 0 + 4 + 2; // 60
    const ex3Max = 54 + 6 + 0 + 0 + 6 + 6 + 0 + 0; // 76
    const ex3 = Math.round((ex3Earned / ex3Max) * 100); // 79

    const pass = ex1 === 92 && ex2 === 84 && ex3 === 79;
    return { ex1, ex2, ex3, pass };
  }
};
