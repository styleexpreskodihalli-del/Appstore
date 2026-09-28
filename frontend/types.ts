// Google Business Profile Management & Information API v1 types

export type PlatformType = 'web' | 'android' | 'ios';

export interface MultiPlatformOAuthConfig {
  webClientId: string;
  androidClientId: string;
  androidPackageName: string;
  iosClientId: string;
  iosBundleId: string;
  redirectUriWeb: string;
  redirectUriAndroid: string;
  redirectUriIOS: string;
}

export interface PlatformAuthSession {
  platform: PlatformType;
  accessToken: string;
  expiresAt: number;
  scopes: string[];
}

export interface GoogleAccount {
  name: string;
  accountName: string;
  type?: 'PERSONAL' | 'ORGANIZATION' | 'LOCATION_GROUP' | string;
  role?: string;
  state?: {
    status?: string;
  };
}

export interface GooglePostalAddress {
  revision?: number;
  regionCode?: string;
  languageCode?: string;
  postalCode?: string;
  sortingCode?: string;
  administrativeArea?: string;
  locality?: string;
  sublocality?: string;
  addressLines?: string[];
}

export interface GoogleLatLng {
  latitude: number;
  longitude: number;
}

export interface GoogleTimePeriod {
  openDay: string;
  openTime: { hours?: number; minutes?: number };
  closeDay: string;
  closeTime: { hours?: number; minutes?: number };
}

export interface GoogleSpecialHours {
  specialHourPeriods?: Array<{
    startDate?: { year?: number; month?: number; day?: number };
    openTime?: { hours?: number; minutes?: number };
    endDate?: { year?: number; month?: number; day?: number };
    closeTime?: { hours?: number; minutes?: number };
    closed?: boolean;
  }>;
}

export interface GoogleCategory {
  name?: string;
  displayName?: string;
  serviceTypes?: { serviceTypeId: string; displayName: string }[];
}

export interface GoogleServiceItem {
  freeFormServiceItem?: {
    category?: string;
    label?: { displayName?: string; description?: string };
  };
  structuredServiceItem?: {
    serviceTypeId?: string;
    description?: string;
  };
  price?: {
    currencyCode?: string;
    units?: string;
    nanos?: number;
  };
}

export interface GoogleLocation {
  name: string;
  title: string;
  storefrontAddress?: GooglePostalAddress;
  latlng?: GoogleLatLng;
  websiteUri?: string;
  phoneNumbers?: {
    primaryPhone?: string;
    additionalPhones?: string[];
  };
  categories?: {
    primaryCategory?: GoogleCategory;
    additionalCategories?: GoogleCategory[];
  };
  regularHours?: {
    periods?: GoogleTimePeriod[];
  };
  specialHours?: GoogleSpecialHours;
  serviceItems?: GoogleServiceItem[];
  profile?: {
    description?: string;
  };
  metadata?: {
    placeId?: string;
    mapsUri?: string;
    newReviewUri?: string;
    hasVoiceOfMerchant?: boolean;
    hasPendingEdits?: boolean;
    canDelete?: boolean;
    canModifyServiceList?: boolean;
  };
  labels?: string[];
  serviceArea?: {
    businessType?: string;
    places?: { placeId: string; placeName: string }[];
  };
}

export interface BusinessServiceItem {
  id: string;
  displayName: string;
  category: string;
  price?: string;
  description?: string;
  isAvailableOnGoogle: boolean;
  syncStatus?: 'SYNCED' | 'PENDING' | 'FAILED' | 'LOCAL_DRAFT';
  errorMessage?: string;
  serviceTypeId?: string;
}

export interface BusinessReviewItem {
  id: string;
  reviewerName: string;
  reviewerPhotoUrl?: string;
  starRating: 1 | 2 | 3 | 4 | 5 | null;
  comment: string;
  createTime: string;
  reviewReply?: {
    comment: string;
    updateTime: string;
  };
}

export interface BusinessPhotoItem {
  id: string;
  category: 'EXTERIOR' | 'INTERIOR' | 'PRODUCT' | 'TEAM';
  url: string;
  caption: string;
  viewsCount: number;
  uploadDate: string;
}

export interface BusinessOfferItem {
  id: string;
  title: string;
  couponCode?: string;
  discountSummary: string;
  validThrough: string;
  status: 'ACTIVE' | 'SCHEDULED' | 'EXPIRED';
  redeemedCount: number;
}

export interface LocalCustomerTransaction {
  id: string;
  customerName: string;
  customerContact: string;
  type: 'LEAD' | 'ORDER' | 'BOOKING';
  summary: string;
  timestamp: string;
  status: 'NEW' | 'CONFIRMED' | 'FULFILLED';
  channel: 'STALL_PAGE' | 'GOOGLE_CLICK';
  verified: boolean;
}

// Google Business Profile Performance API data model
export interface GBPDate {
  year: number;
  month: number;
  day: number;
}

export interface GBPPerformanceMetrics {
  mapsImpressions: number | null;
  searchImpressions: number | null;
  calls: number | null;
  directions: number | null;
  websiteClicks: number | null;
  conversations: number | null;
  desktopMapsImpressions?: number | null;
  mobileMapsImpressions?: number | null;
  desktopSearchImpressions?: number | null;
  mobileSearchImpressions?: number | null;
}

export interface GBPDailyMetricPoint {
  dateStr: string;
  mapsImpressions: number | null;
  searchImpressions: number | null;
  calls: number | null;
  directions: number | null;
  websiteClicks: number | null;
  conversations: number | null;
}

export interface GBPPerformanceData {
  period: {
    startDate: GBPDate;
    endDate: GBPDate;
    days: number;
  };
  source: 'Google Business Profile Performance API';
  metrics: GBPPerformanceMetrics;
  daily: GBPDailyMetricPoint[];
  rawResponse?: unknown;
}

export interface STallBusinessProfile {
  accountName: string;
  locationResourceName: string;
  title: string;
  placeId: string;
  phone: string;
  website: string;
  formattedAddress: string;
  coordinates: {
    lat: number | null;
    lng: number | null;
  };
  primaryCategory: string;
  additionalCategories: string[];
  mapsUri?: string;
  hasVoiceOfMerchant: boolean;
  hasPendingEdits: boolean;
  openHoursSummary: string;
  specialHoursSummary: string;
  description: string;
  sourceIndicator: 'Source: Google Business Profile';
  rawGoogleLocation: GoogleLocation;
  connectedAt: string;
  platformSource?: PlatformType;
  isPreviewDevSession?: boolean;
  services?: BusinessServiceItem[];
  reviews?: BusinessReviewItem[];
  photos?: BusinessPhotoItem[];
  offers?: BusinessOfferItem[];
  transactions?: LocalCustomerTransaction[];
  performance?: GBPPerformanceData;
  googleAverageRating?: number | null;
  googleTotalReviewCount?: number | null;
}

export interface GrowthAction {
  id: string;
  title: string;
  category: 'PROFILE_OPTIMIZATION' | 'HOURS_UPDATE' | 'PHOTO_ASSET' | 'SERVICES_EXPANSION' | 'REVIEW_STRATEGY';
  impactScore: number;
  effortMinutes: number;
  description: string;
  technicalDetails?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXECUTED';
  executedAt?: string;
}

export interface DigitalScoreComponentResult {
  code: string;
  name: string;
  pillar: 'Profile Readiness' | 'Customer Engagement' | 'Google Performance' | 'STall Conversions';
  maxPoints: number;
  earnedPoints: number;
  isAssessable: boolean;
  statusNote: string;
}

export interface DigitalScoreBreakdown {
  totalScore: number | null;
  earnedAssessablePoints: number;
  maxAssessablePoints: number;
  profileReadinessScore: number;
  customerEngagementScore: number;
  googlePerformanceScore: number;
  stallConversionsScore: number;
  verificationScore: number;
  addressAndMapScore: number;
  contactAndWebScore: number;
  categoryAndServicesScore: number;
  hoursScore: number;
  components: DigitalScoreComponentResult[];
  recommendations: string[];
}
