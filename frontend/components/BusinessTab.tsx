import React, { useState, useEffect, useCallback } from 'react';
import { STallBusinessProfile, BusinessServiceItem, BusinessReviewItem, BusinessPhotoItem, BusinessOfferItem, LocalCustomerTransaction, GoogleServiceItem } from '../types';
import { GoogleBusinessService } from '../services/googleBusinessService';
import { GoogleGenAI } from '@google/genai';
import { 
  Building2, 
  MapPin, 
  Phone, 
  Globe, 
  Clock, 
  Tag, 
  ExternalLink, 
  ShieldCheck, 
  AlertCircle, 
  Copy, 
  Star, 
  MessageSquare, 
  Plus, 
  Share2, 
  RefreshCw, 
  Send, 
  User, 
  CheckCircle2, 
  Sparkles, 
  AlertTriangle,
  Flame,
  FileText,
  Calendar,
  Layers,
  Code,
  Check,
  XCircle
} from 'lucide-react';

interface BusinessTabProps {
  profile: STallBusinessProfile;
}

export const BusinessTab: React.FC<BusinessTabProps> = ({ profile }) => {
  const [copied, setCopied] = useState(false);
  const [activeSubSection, setActiveSubSection] = useState<'profile' | 'services' | 'photos' | 'reviews' | 'offers' | 'raw'>('profile');
  
  // Reviews state management
  const [reviews, setReviews] = useState<BusinessReviewItem[]>(() => profile.reviews || []);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsError, setReviewsError] = useState<string | null>(null);
  const [averageRating, setAverageRating] = useState<number | null>(profile.googleAverageRating ?? null);
  const [totalReviewCount, setTotalReviewCount] = useState<number>(profile.googleTotalReviewCount ?? (profile.reviews?.length || 0));
  
  // Review filtering state
  const [reviewFilter, setReviewFilter] = useState<'all' | 'unreplied' | 'critical' | 'positive'>('all');

  // Review replying state
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [submittingReplyId, setSubmittingReplyId] = useState<string | null>(null);
  const [replySuccessMessage, setReplySuccessMessage] = useState<string | null>(null);

  // AI draft generating state per review ID
  const [generatingAiId, setGeneratingAiId] = useState<string | null>(null);
  const [aiTone, setAiTone] = useState<'warm' | 'professional' | 'concise'>('warm');

  // Services catalog state & Google sync
  const [services, setServices] = useState<BusinessServiceItem[]>(() => profile.services || []);
  const [showAddService, setShowAddService] = useState(false);
  const [newServiceName, setNewServiceName] = useState('');
  const [newServicePrice, setNewServicePrice] = useState('');
  const [newServiceDescription, setNewServiceDescription] = useState('');
  const [isSyncingService, setIsSyncingService] = useState(false);
  const [serviceSyncError, setServiceSyncError] = useState<string | null>(null);
  const [serviceSyncSuccess, setServiceSyncSuccess] = useState<string | null>(null);

  // Real data collections: strictly real or empty
  const photos: BusinessPhotoItem[] = profile.photos || [];
  const offers: BusinessOfferItem[] = profile.offers || [];

  // Review badges
  const unrepliedCount = reviews.filter((r) => !r.reviewReply).length;
  const criticalReviews = reviews.filter((r) => r.starRating !== null && r.starRating <= 3);
  const criticalUnrepliedReviews = criticalReviews.filter((r) => !r.reviewReply);
  const criticalUnrepliedCount = criticalUnrepliedReviews.length;

  const filteredReviews = reviews.filter((r) => {
    if (reviewFilter === 'unreplied') return !r.reviewReply;
    if (reviewFilter === 'critical') return r.starRating !== null && r.starRating <= 3;
    if (reviewFilter === 'positive') return r.starRating !== null && r.starRating >= 4;
    return true;
  });

  // Fetch live reviews from Google Business Profile API with pagination
  const fetchLiveGoogleReviews = useCallback(async () => {
    if (profile.isPreviewDevSession) {
      if (profile.reviews && profile.reviews.length > 0) {
        setReviews(profile.reviews);
        setTotalReviewCount(profile.reviews.length);
        const rated = profile.reviews.filter((r) => r.starRating !== null);
        if (rated.length > 0) {
          const sum = rated.reduce((acc, r) => acc + (r.starRating || 0), 0);
          setAverageRating(Number((sum / rated.length).toFixed(1)));
        } else {
          setAverageRating(null);
        }
      }
      return;
    }

    const token = GoogleBusinessService.getStoredAccessToken();
    if (!token) {
      setReviewsError('Active Google OAuth access token required to fetch reviews.');
      return;
    }

    setReviewsLoading(true);
    setReviewsError(null);
    try {
      const data = await GoogleBusinessService.fetchReviews(
        profile.accountName,
        profile.locationResourceName,
        token
      );
      setReviews(data.reviews);
      profile.reviews = data.reviews;

      if (typeof data.averageRating === 'number') {
        setAverageRating(data.averageRating);
        profile.googleAverageRating = data.averageRating;
      } else {
        const rated = data.reviews.filter((r) => r.starRating !== null);
        if (rated.length > 0) {
          const sum = rated.reduce((acc, r) => acc + (r.starRating || 0), 0);
          const computedMean = Number((sum / rated.length).toFixed(1));
          setAverageRating(computedMean);
          profile.googleAverageRating = computedMean;
        } else {
          setAverageRating(null);
          profile.googleAverageRating = null;
        }
      }

      const totalCount = data.totalReviewCount ?? data.reviews.length;
      setTotalReviewCount(totalCount);
      profile.googleTotalReviewCount = totalCount;
      GoogleBusinessService.setStoredBusinessProfile(profile);
    } catch (err: unknown) {
      console.error('[STall GBP] Failed to fetch Google reviews:', err);
      setReviewsError(err instanceof Error ? err.message : 'Failed to retrieve reviews from Google.');
    } finally {
      setReviewsLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    if (activeSubSection === 'reviews') {
      fetchLiveGoogleReviews();
    }
  }, [activeSubSection, fetchLiveGoogleReviews]);

  const copyPlaceId = () => {
    if (!profile.placeId) return;
    navigator.clipboard.writeText(profile.placeId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Real Google Business Profile Service Synchronization Flow
  const handlePublishServiceToGoogle = async (e: React.FormEvent) => {
    e.preventDefault();
    setServiceSyncError(null);
    setServiceSyncSuccess(null);

    const name = newServiceName.trim();
    if (!name) {
      setServiceSyncError('Service name is required.');
      return;
    }

    // Verify user has modification permission on this location
    if (profile.rawGoogleLocation.metadata?.canModifyServiceList === false) {
      setServiceSyncError('Google indicates service modification is restricted for this business location.');
      return;
    }

    // Verify verified Google category resource exists (NO FABRICATED FALLBACK)
    const validCategoryResource = profile.rawGoogleLocation.categories?.primaryCategory?.name ||
      profile.rawGoogleLocation.categories?.additionalCategories?.find(c => c.name)?.name;

    if (!validCategoryResource) {
      setServiceSyncError('This Google location does not have a verified category resource registered. Service cannot be published without a verified Google category.');
      return;
    }

    // Dev sandbox mode handling
    if (profile.isPreviewDevSession) {
      const mockItem: BusinessServiceItem = {
        id: `sandbox-srv-${Date.now()}`,
        displayName: name,
        category: profile.primaryCategory || 'Services',
        price: newServicePrice.trim() || undefined,
        description: newServiceDescription.trim() || undefined,
        isAvailableOnGoogle: false,
        syncStatus: 'LOCAL_DRAFT',
      };
      setServices((prev) => [mockItem, ...prev]);
      setNewServiceName('');
      setNewServicePrice('');
      setNewServiceDescription('');
      setShowAddService(false);
      setServiceSyncSuccess('Saved as local draft (Sandbox Preview mode).');
      setTimeout(() => setServiceSyncSuccess(null), 3000);
      return;
    }

    const token = GoogleBusinessService.getStoredAccessToken();
    if (!token) {
      setServiceSyncError('Active Google OAuth access token required to update Google Business Profile services.');
      return;
    }

    setIsSyncingService(true);

    try {
      // Read existing Google serviceItems first to preserve all existing services
      const currentGoogleItems: GoogleServiceItem[] = [
        ...(profile.rawGoogleLocation.serviceItems || []),
      ];

      // Build normalized service item payload using verified category
      const newGoogleServiceItem: GoogleServiceItem = {
        freeFormServiceItem: {
          category: validCategoryResource,
          label: {
            displayName: name,
            description: newServiceDescription.trim() || undefined,
          },
        },
      };

      // Currency handling - NEVER hardcode USD/INR/etc.
      const trustworthyCurrency = currentGoogleItems.find(s => s.price?.currencyCode)?.price?.currencyCode;
      const numericPrice = newServicePrice.replace(/[^0-9.]/g, '');

      if (numericPrice && !isNaN(parseFloat(numericPrice)) && trustworthyCurrency) {
        newGoogleServiceItem.price = {
          currencyCode: trustworthyCurrency,
          units: Math.floor(parseFloat(numericPrice)).toString(),
        };
      }

      // Merge new item without deleting existing services
      const mergedGoogleItems: GoogleServiceItem[] = [
        ...currentGoogleItems,
        newGoogleServiceItem,
      ];

      // Perform real authenticated Google API write
      await GoogleBusinessService.updateServiceItems(
        profile.locationResourceName,
        mergedGoogleItems,
        token
      );

      // Verify after write by re-fetching the real location from Google
      const verifiedLocation = await GoogleBusinessService.fetchLocationDetail(
        profile.locationResourceName,
        token
      );

      // Strict exact service identity verification
      const verifiedItems = verifiedLocation.serviceItems || [];
      const serviceConfirmed = verifiedItems.some(
        (item) => 
          item.freeFormServiceItem?.label?.displayName?.trim().toLowerCase() === name.toLowerCase() ||
          (item.structuredServiceItem?.serviceTypeId && item.structuredServiceItem.serviceTypeId.trim().toLowerCase() === name.toLowerCase())
      );

      if (serviceConfirmed) {
        profile.rawGoogleLocation = verifiedLocation;
        const updatedSTallProfile = GoogleBusinessService.mapGoogleLocationToSTallProfile(
          profile.accountName,
          verifiedLocation
        );
        GoogleBusinessService.setStoredBusinessProfile(updatedSTallProfile);
        setServices(updatedSTallProfile.services || []);

        setNewServiceName('');
        setNewServicePrice('');
        setNewServiceDescription('');
        setShowAddService(false);
        setServiceSyncSuccess(`✓ Published "${name}" directly to Google Business Profile!`);
        setTimeout(() => setServiceSyncSuccess(null), 4000);
      } else {
        setServiceSyncError('Google accepted the update, but the service could not yet be verified in the refreshed Google location.');
      }
    } catch (err: unknown) {
      console.error('[STall GBP] Failed to sync service to Google:', err);
      setServiceSyncError(err instanceof Error ? err.message : 'Google API rejected the service update.');
    } finally {
      setIsSyncingService(false);
    }
  };

  // AI-assisted response generator using Gemini API
  const handleGenerateAiReply = async (review: BusinessReviewItem, overrideTone?: 'urgent' | 'warm' | 'professional') => {
    setGeneratingAiId(review.id);
    setReviewsError(null);

    const isUrgent = overrideTone === 'urgent' || (review.starRating !== null && review.starRating <= 2);
    const effectiveTone = isUrgent ? 'urgent service recovery' : overrideTone || aiTone;

    const toneDescriptions = {
      warm: 'warm, appreciative, genuine, and hospitable',
      professional: 'composed, courteous, solution-oriented, and reassuring',
      concise: 'brief, gracious, and to the point (under 2 sentences)',
      'urgent service recovery': 'urgently empathetic, sincere, taking immediate accountability without being defensive, and inviting offline resolution',
    };

    const ratingText = review.starRating !== null ? `${review.starRating}-star` : 'unrated';
    const prompt = `You are the local business owner of "${profile.title}", a ${profile.primaryCategory || 'local business'}.
A customer named "${review.reviewerName}" left a ${ratingText} review on Google Business Profile with this comment:
"${review.comment}"

Write an official response to this review.
Requirements:
1. Tone: ${toneDescriptions[effectiveTone as keyof typeof toneDescriptions] || toneDescriptions.warm}.
2. If this is a critical or low-star review (1-3 stars): Express genuine regret that their visit did not meet expectations. Confirm that the management team takes this personally, apologize for the specific issue mentioned, and invite them to connect with the owner to make things right.
3. If this is a positive review (4-5 stars): Thank them warmly for their support, reference the specific highlight they enjoyed, and welcome them back.
4. Keep it direct and natural. Do NOT use brackets or placeholders like [Your Name] or [Phone Number].
5. Length: 2 to 4 sentences. Return ONLY the reply text.`;

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY, vertexai: true });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      const generatedText = response.text?.trim();
      if (generatedText) {
        setReplyDrafts((prev) => ({ ...prev, [review.id]: generatedText }));
      } else {
        throw new Error('Empty draft returned.');
      }
    } catch (err: unknown) {
      console.warn('[STall AI] Gemini generation error or fallback:', err);
      let fallback = '';
      if (review.starRating !== null && review.starRating <= 3) {
        fallback = `Hello ${review.reviewerName}, thank you for bringing this to our attention. We are genuinely sorry that your experience at ${profile.title} fell short of our standards. Our team is addressing this immediately, and we would appreciate the opportunity to make this right for you on your next visit.`;
      } else {
        fallback = `Thank you so much for the feedback, ${review.reviewerName}! We truly appreciate your support of ${profile.title} and look forward to welcoming you back soon.`;
      }
      setReplyDrafts((prev) => ({ ...prev, [review.id]: fallback }));
    } finally {
      setGeneratingAiId(null);
    }
  };

  const handleDraftAllUrgent = async () => {
    if (criticalUnrepliedReviews.length === 0) return;
    for (const rev of criticalUnrepliedReviews) {
      await handleGenerateAiReply(rev, 'urgent');
    }
    setReviewFilter('critical');
  };

  const handleReplySubmit = async (reviewId: string) => {
    const text = replyDrafts[reviewId];
    if (!text || !text.trim()) return;

    setSubmittingReplyId(reviewId);
    setReplySuccessMessage(null);
    setReviewsError(null);

    if (profile.isPreviewDevSession) {
      setTimeout(() => {
        setReviews((prev) =>
          prev.map((r) =>
            r.id === reviewId
              ? { ...r, reviewReply: { comment: text.trim(), updateTime: 'Just now' } }
              : r
          )
        );
        setReplyDrafts((prev) => ({ ...prev, [reviewId]: '' }));
        setSubmittingReplyId(null);
        setReplySuccessMessage('Reply posted successfully (Sandbox Preview)!');
        setTimeout(() => setReplySuccessMessage(null), 3000);
      }, 600);
      return;
    }

    const token = GoogleBusinessService.getStoredAccessToken();
    if (!token) {
      setReviewsError('Authentication expired. Please re-authenticate to post replies.');
      setSubmittingReplyId(null);
      return;
    }

    try {
      const replyData = await GoogleBusinessService.replyToReview(
        profile.accountName,
        profile.locationResourceName,
        reviewId,
        text.trim(),
        token
      );

      setReviews((prev) =>
        prev.map((r) =>
          r.id === reviewId
            ? { ...r, reviewReply: { comment: replyData.comment, updateTime: replyData.updateTime } }
            : r
        )
      );
      setReplyDrafts((prev) => ({ ...prev, [reviewId]: '' }));
      setReplySuccessMessage('Response published directly to Google Business Profile!');
      setTimeout(() => setReplySuccessMessage(null), 3500);
    } catch (err: unknown) {
      console.error('[STall GBP] Failed to post reply to Google:', err);
      setReviewsError(err instanceof Error ? err.message : 'Failed to publish reply on Google.');
    } finally {
      setSubmittingReplyId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title Card & Source Indicator */}
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold text-white tracking-tight">{profile.title}</h2>
              {/* SOURCE INDICATOR */}
              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                <span>Source: Google Business Profile</span>
              </span>

              {profile.hasVoiceOfMerchant ? (
                <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-medium">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Google Verified</span>
                </span>
              ) : (
                <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-medium">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Pending Verification</span>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-1 font-mono">
              Resource: {profile.locationResourceName}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {profile.mapsUri ? (
              <a
                href={profile.mapsUri}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition"
              >
                <span>View on Maps</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            ) : (
              <span className="text-xs text-slate-500 italic">No Maps URI registered</span>
            )}
            <button
              onClick={() => alert(`STall Public Partner Link:\nhttps://stall.local/b/${profile.placeId || 'live'}`)}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-xs font-semibold text-emerald-400 border border-emerald-500/30 transition"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>STall Customer Page</span>
            </button>
          </div>
        </div>

        {/* Sub-Navigation with Real-Time Badges */}
        <div className="flex items-center space-x-2 mt-6 pt-4 border-t border-slate-800/80 overflow-x-auto">
          <button
            onClick={() => setActiveSubSection('profile')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
              activeSubSection === 'profile' ? 'bg-emerald-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Google Profile
          </button>
          <button
            onClick={() => setActiveSubSection('services')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition flex items-center space-x-1.5 ${
              activeSubSection === 'services' ? 'bg-emerald-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>Google Services ({services.length})</span>
            {services.some((s) => s.isAvailableOnGoogle) && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            )}
          </button>
          <button
            onClick={() => setActiveSubSection('photos')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
              activeSubSection === 'photos' ? 'bg-emerald-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Photos ({photos.length})
          </button>
          
          <button
            onClick={() => setActiveSubSection('reviews')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition flex items-center space-x-2 ${
              activeSubSection === 'reviews' ? 'bg-emerald-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Google Reviews ({reviews.length})</span>
            {criticalUnrepliedCount > 0 ? (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                activeSubSection === 'reviews' ? 'bg-rose-900 text-rose-100' : 'bg-rose-500 text-white animate-pulse'
              }`}>
                {criticalUnrepliedCount} urgent
              </span>
            ) : unrepliedCount > 0 ? (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                activeSubSection === 'reviews' ? 'bg-slate-900 text-amber-300' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              }`}>
                {unrepliedCount} pending
              </span>
            ) : null}
          </button>

          <button
            onClick={() => setActiveSubSection('offers')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
              activeSubSection === 'offers' ? 'bg-emerald-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Offers & Deals ({offers.length})
          </button>

          <button
            onClick={() => setActiveSubSection('raw')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition flex items-center space-x-1.5 ${
              activeSubSection === 'raw' ? 'bg-emerald-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            <span>Raw Google Source Trace</span>
          </button>
        </div>
      </div>

      {/* SUB-SECTION 1: Authentic Google Profile Details */}
      {activeSubSection === 'profile' && (
        <div className="space-y-6">
          <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-2">
            <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-slate-400">
              <FileText className="w-4 h-4 text-emerald-400" />
              <span>Google Profile Description</span>
            </div>
            {profile.description ? (
              <p className="text-xs text-slate-200 leading-relaxed max-w-4xl">{profile.description}</p>
            ) : (
              <p className="text-xs text-slate-500 italic">No description published on Google Business Profile.</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Storefront & Physical Coordinates
              </h3>

              <div className="space-y-3 text-xs">
                <div className="flex items-start space-x-2.5">
                  <MapPin className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="text-slate-500 block font-medium">Storefront Address</span>
                    <span className="text-slate-200 font-medium">
                      {profile.formattedAddress || <span className="text-slate-500 italic">No storefront address (Service Area only)</span>}
                    </span>
                  </div>
                </div>

                <div className="flex items-start space-x-2.5 pt-2 border-t border-slate-800/80">
                  <Building2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <span className="text-slate-500 block font-medium">Google Place ID</span>
                    <div className="flex items-center space-x-2 mt-0.5">
                      <code className="text-slate-300 font-mono text-[11px]">
                        {profile.placeId || <span className="text-slate-500 italic">Not provided by Google</span>}
                      </code>
                      {profile.placeId && (
                        <button
                          onClick={copyPlaceId}
                          className="text-slate-400 hover:text-white"
                          title="Copy Place ID"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {copied && <span className="text-[10px] text-emerald-400">Copied!</span>}
                    </div>
                  </div>
                </div>

                <div className="flex items-start space-x-2.5 pt-2 border-t border-slate-800/80">
                  <div className="w-4 h-4 flex items-center justify-center font-bold text-emerald-400">
                    ⌖
                  </div>
                  <div>
                    <span className="text-slate-500 block font-medium">Latitude / Longitude</span>
                    <span className="text-slate-300 font-mono">
                      {profile.coordinates.lat !== null && profile.coordinates.lng !== null
                        ? `${profile.coordinates.lat.toFixed(6)}, ${profile.coordinates.lng.toFixed(6)}`
                        : <span className="text-slate-500 italic">Coordinates not published by Google</span>}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Contact & Category Classification
              </h3>

              <div className="space-y-3 text-xs">
                <div className="flex items-start space-x-2.5">
                  <Phone className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="text-slate-500 block font-medium">Primary Telephone</span>
                    <span className="text-slate-200 font-mono">
                      {profile.phone || <span className="text-slate-500 italic">Not provided by Google</span>}
                    </span>
                  </div>
                </div>

                <div className="flex items-start space-x-2.5 pt-2 border-t border-slate-800/80">
                  <Globe className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                  <div className="truncate">
                    <span className="text-slate-500 block font-medium">Verified Website URI</span>
                    {profile.website ? (
                      <a
                        href={profile.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-400 hover:underline truncate block"
                      >
                        {profile.website}
                      </a>
                    ) : (
                      <span className="text-slate-500 italic">No website attached to GBP</span>
                    )}
                  </div>
                </div>

                <div className="flex items-start space-x-2.5 pt-2 border-t border-slate-800/80">
                  <Tag className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="text-slate-500 block font-medium">Primary Category</span>
                    <span className="text-slate-200 font-semibold">
                      {profile.primaryCategory || <span className="text-slate-500 italic">Unspecified</span>}
                    </span>

                    {profile.additionalCategories && profile.additionalCategories.length > 0 ? (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {profile.additionalCategories.map((cat, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]"
                          >
                            {cat}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl">
              <div className="flex items-center space-x-2 mb-3">
                <Clock className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Regular Operating Hours
                </h3>
              </div>
              <p className="text-xs text-slate-300">{profile.openHoursSummary}</p>
            </div>

            <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl">
              <div className="flex items-center space-x-2 mb-3">
                <Calendar className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Special / Holiday Hours
                </h3>
              </div>
              <p className="text-xs text-slate-300">
                {profile.specialHoursSummary || <span className="text-slate-500 italic">No special hours or holiday schedules published.</span>}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* SUB-SECTION 2: Real Google Services Synchronization */}
      {activeSubSection === 'services' && (
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-800/80">
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Google Business Profile Services ({services.length})
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  GBP v1 Live Sync
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Services published here synchronize directly to your Google location Knowledge Panel and Search 3-Pack.
              </p>
            </div>

            <button
              onClick={() => {
                setShowAddService(!showAddService);
                setServiceSyncError(null);
                setServiceSyncSuccess(null);
              }}
              className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center space-x-1 self-start sm:self-auto transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{showAddService ? 'Close Form' : 'Add Google Service'}</span>
            </button>
          </div>

          {/* Sync Alerts */}
          {serviceSyncError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{serviceSyncError}</div>
            </div>
          )}

          {serviceSyncSuccess && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>{serviceSyncSuccess}</span>
            </div>
          )}

          {/* Real Google Service Add Form */}
          {showAddService && (
            <form onSubmit={handlePublishServiceToGoogle} className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
              <div className="text-xs font-bold text-white flex items-center space-x-2">
                <span>Publish New Service to Google Business Profile</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <input
                  type="text"
                  placeholder="Service Name (e.g. Single Origin Drip)"
                  value={newServiceName}
                  onChange={(e) => setNewServiceName(e.target.value)}
                  disabled={isSyncingService}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 disabled:opacity-50"
                />
                <input
                  type="text"
                  placeholder="Price (optional, e.g. 250)"
                  value={newServicePrice}
                  onChange={(e) => setNewServicePrice(e.target.value)}
                  disabled={isSyncingService}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 disabled:opacity-50"
                />
                <input
                  type="text"
                  placeholder="Description (optional, max 100 chars)"
                  value={newServiceDescription}
                  onChange={(e) => setNewServiceDescription(e.target.value)}
                  disabled={isSyncingService}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 disabled:opacity-50"
                />
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-800">
                <span className="text-[11px] text-slate-500">
                  Category: <strong className="text-slate-400">{profile.primaryCategory || 'Primary Category'}</strong>
                </span>
                <div className="flex space-x-2 self-end sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setShowAddService(false)}
                    disabled={isSyncingService}
                    className="px-3 py-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-white text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSyncingService || !newServiceName.trim()}
                    className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold text-xs flex items-center space-x-1.5 transition"
                  >
                    {isSyncingService ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Publishing to Google...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Publish to Google</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Services List with Distinct Verified UI States */}
          {services.length === 0 ? (
            <div className="p-8 border border-dashed border-slate-800 rounded-xl text-center space-y-1">
              <p className="text-sm font-semibold text-slate-300">No services published on Google</p>
              <p className="text-xs text-slate-500">
                This Google location currently has no service items registered. Click "Add Google Service" above to publish your first service.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {services.map((srv) => (
                <div key={srv.id} className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2 flex flex-col justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white truncate max-w-[170px]">{srv.displayName}</span>
                      {srv.price && <span className="text-xs font-mono text-emerald-400 font-bold">{srv.price}</span>}
                    </div>
                    {srv.description && (
                      <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-2">{srv.description}</p>
                    )}
                  </div>

                  {/* Clear UI distinction between Google Synced vs Local */}
                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px]">
                    <span className="px-2 py-0.5 rounded bg-slate-900 text-slate-400 font-mono">
                      {srv.category}
                    </span>
                    {srv.isAvailableOnGoogle || srv.syncStatus === 'SYNCED' ? (
                      <span className="flex items-center space-x-1 text-emerald-400 font-semibold" title="Live on Google Knowledge Panel">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        <span>✓ Published to Google</span>
                      </span>
                    ) : srv.syncStatus === 'FAILED' ? (
                      <span className="flex items-center space-x-1 text-rose-400 font-semibold">
                        <XCircle className="w-3 h-3 text-rose-400" />
                        <span>⚠ Not published to Google</span>
                      </span>
                    ) : (
                      <span className="flex items-center space-x-1 text-amber-400 font-medium">
                        <Clock className="w-3 h-3 text-amber-400" />
                        <span>Local Draft</span>
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUB-SECTION 3: Photos */}
      {activeSubSection === 'photos' && (
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Google Maps Photos
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Uploaded photos from the connected Google Business Profile.
              </p>
            </div>
          </div>

          {photos.length === 0 ? (
            <div className="p-8 border border-dashed border-slate-800 rounded-xl text-center space-y-1">
              <p className="text-sm font-semibold text-slate-300">No media assets found on Google</p>
              <p className="text-xs text-slate-500">
                Photos uploaded directly to your GBP location will appear here once synchronized.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {photos.map((photo) => (
                <div key={photo.id} className="bg-slate-950 rounded-xl overflow-hidden border border-slate-800">
                  <div className="relative h-44 overflow-hidden bg-slate-900">
                    <img
                      src={photo.url}
                      alt={photo.caption}
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-slate-950/80 backdrop-blur text-[10px] text-slate-300 font-mono border border-slate-800">
                      {photo.category}
                    </span>
                  </div>
                  <div className="p-3 space-y-1">
                    <p className="text-xs text-white font-medium truncate">{photo.caption}</p>
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>{photo.viewsCount} Views</span>
                      <span>{photo.uploadDate}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUB-SECTION 4: Real-Time Google Reviews */}
      {activeSubSection === 'reviews' && (
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-5">
          {/* Header & Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800/80">
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-white flex items-center space-x-2">
                  <MessageSquare className="w-4 h-4 text-emerald-400" />
                  <span>Google Business Profile Customer Reviews</span>
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Direct GBP v4
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Fetched live from your Google location. Generate tailored AI responses and post directly to Google Maps and Search.
              </p>
            </div>

            <div className="flex items-center space-x-2.5">
              <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-[11px]">
                <span className="text-slate-500 px-1 font-medium">Default Tone:</span>
                <button
                  onClick={() => setAiTone('warm')}
                  className={`px-2 py-0.5 rounded transition ${aiTone === 'warm' ? 'bg-emerald-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'}`}
                >
                  Warm
                </button>
                <button
                  onClick={() => setAiTone('professional')}
                  className={`px-2 py-0.5 rounded transition ${aiTone === 'professional' ? 'bg-emerald-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'}`}
                >
                  Pro
                </button>
                <button
                  onClick={() => setAiTone('concise')}
                  className={`px-2 py-0.5 rounded transition ${aiTone === 'concise' ? 'bg-emerald-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'}`}
                >
                  Short
                </button>
              </div>

              <button
                onClick={fetchLiveGoogleReviews}
                disabled={reviewsLoading}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition flex items-center space-x-1.5 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${reviewsLoading ? 'animate-spin text-emerald-400' : ''}`} />
                <span>{reviewsLoading ? 'Syncing...' : 'Refresh'}</span>
              </button>
            </div>
          </div>

          {/* Urgent Low-Star Action Alert Banner */}
          {criticalUnrepliedCount > 0 && (
            <div className="p-4 bg-gradient-to-r from-rose-950/60 to-amber-950/40 border border-rose-500/40 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg shadow-rose-950/20">
              <div className="flex items-start space-x-3">
                <div className="w-9 h-9 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center flex-shrink-0 text-rose-400">
                  <Flame className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-bold text-white">
                      {criticalUnrepliedCount} Critical Review{criticalUnrepliedCount > 1 ? 's' : ''} Awaiting Owner Reply
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold">
                      Priority Response Needed
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                    Respond promptly to customer reviews to keep your Google Business Profile communication current.
                  </p>
                </div>
              </div>

              <button
                onClick={handleDraftAllUrgent}
                disabled={generatingAiId !== null}
                className="px-3.5 py-2 bg-rose-500 hover:bg-rose-400 text-slate-950 text-xs font-bold rounded-xl transition flex items-center justify-center space-x-1.5 shadow-md flex-shrink-0 disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5 fill-current" />
                <span>1-Click Urgent Resolution Drafts</span>
              </button>
            </div>
          )}

          {/* Aggregate Rating Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-slate-950 rounded-xl border border-slate-800/80">
            <div className="flex items-center space-x-3">
              <div className="text-3xl font-black text-white">
                {averageRating !== null ? averageRating : '—'}
              </div>
              <div>
                <div className="flex text-amber-400">
                  {averageRating !== null ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`w-3.5 h-3.5 ${
                          i < Math.round(averageRating) ? 'fill-current' : 'text-slate-700'
                        }`}
                      />
                    ))
                  ) : (
                    <span className="text-xs text-slate-500 italic">No ratings yet</span>
                  )}
                </div>
                <span className="text-[11px] text-slate-500 font-medium">Average Star Rating</span>
              </div>
            </div>

            <div className="border-t sm:border-t-0 sm:border-l border-slate-800/80 pt-2 sm:pt-0 sm:pl-4 flex flex-col justify-center">
              <span className="text-lg font-bold text-slate-200">{totalReviewCount}</span>
              <span className="text-[11px] text-slate-500 font-medium">Total Google Reviews</span>
            </div>

            <div className="border-t sm:border-t-0 sm:border-l border-slate-800/80 pt-2 sm:pt-0 sm:pl-4 flex flex-col justify-center">
              <span className="text-xs font-semibold text-emerald-400 flex items-center space-x-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>AI-Powered Review Management</span>
              </span>
              <span className="text-[11px] text-slate-500 font-medium">Responds in seconds with Gemini 2.5 Flash</span>
            </div>
          </div>

          {/* Review Filter Navigation Tabs */}
          <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1">
            <div className="flex items-center space-x-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                onClick={() => setReviewFilter('all')}
                className={`px-3 py-1 rounded-lg font-semibold transition ${
                  reviewFilter === 'all'
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                All ({reviews.length})
              </button>

              <button
                onClick={() => setReviewFilter('unreplied')}
                className={`px-3 py-1 rounded-lg font-semibold transition flex items-center space-x-1.5 ${
                  reviewFilter === 'unreplied'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>Unreplied</span>
                {unrepliedCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500 text-slate-950 font-black">
                    {unrepliedCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => setReviewFilter('critical')}
                className={`px-3 py-1 rounded-lg font-semibold transition flex items-center space-x-1.5 ${
                  reviewFilter === 'critical'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>Critical (1-3★)</span>
                {criticalReviews.length > 0 && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                    criticalUnrepliedCount > 0 ? 'bg-rose-500 text-white' : 'bg-slate-800 text-slate-300'
                  }`}>
                    {criticalReviews.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setReviewFilter('positive')}
                className={`px-3 py-1 rounded-lg font-semibold transition ${
                  reviewFilter === 'positive'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Positive (4-5★)
              </button>
            </div>

            <span className="text-[11px] text-slate-500 hidden sm:inline">
              Showing {filteredReviews.length} of {reviews.length} reviews
            </span>
          </div>

          {/* Alerts / Error feedback */}
          {reviewsError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{reviewsError}</div>
            </div>
          )}

          {replySuccessMessage && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>{replySuccessMessage}</span>
            </div>
          )}

          {/* Reviews List */}
          {reviewsLoading && reviews.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs flex flex-col items-center justify-center space-y-2">
              <RefreshCw className="w-5 h-5 animate-spin text-emerald-400" />
              <span>Fetching live reviews from Google Business Profile...</span>
            </div>
          ) : filteredReviews.length === 0 ? (
            <div className="p-8 border border-dashed border-slate-800 rounded-xl text-center space-y-1">
              <p className="text-sm font-semibold text-slate-300">No matching reviews found</p>
              <p className="text-xs text-slate-500">
                {reviewFilter === 'unreplied'
                  ? 'All reviews currently have owner replies posted on Google!'
                  : reviewFilter === 'critical'
                  ? 'No critical reviews found for this location.'
                  : 'No reviews found in this filter category.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredReviews.map((rev) => {
                const isReplyingThis = submittingReplyId === rev.id;
                const isGeneratingThis = generatingAiId === rev.id;
                const draft = replyDrafts[rev.id] || '';
                const isNegative = rev.starRating !== null && rev.starRating <= 3;
                const isUnreplied = !rev.reviewReply;

                return (
                  <div
                    key={rev.id}
                    className={`p-5 rounded-xl border transition space-y-3 ${
                      isNegative && isUnreplied
                        ? 'bg-rose-950/15 border-rose-500/40 shadow-sm shadow-rose-950/20'
                        : 'bg-slate-950 border-slate-800 hover:border-slate-700/80'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center space-x-2.5">
                        {rev.reviewerPhotoUrl ? (
                          <img
                            src={rev.reviewerPhotoUrl}
                            alt={rev.reviewerName}
                            className="w-8 h-8 rounded-full object-cover border border-slate-700"
                          />
                        ) : (
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center border font-bold text-xs ${
                            isNegative ? 'bg-rose-950 border-rose-800 text-rose-300' : 'bg-slate-800 border-slate-700 text-slate-400'
                          }`}>
                            <User className="w-4 h-4" />
                          </div>
                        )}
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-bold text-white">{rev.reviewerName}</span>
                            {isNegative && isUnreplied && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30 flex items-center space-x-1">
                                <AlertTriangle className="w-2.5 h-2.5 text-rose-400" />
                                <span>Needs Attention</span>
                              </span>
                            )}
                          </div>
                          <div className="flex items-center space-x-1.5 mt-0.5">
                            <div className="flex text-amber-400">
                              {rev.starRating !== null ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                  <Star
                                    key={i}
                                    className={`w-3 h-3 ${i < (rev.starRating || 0) ? 'fill-current' : 'text-slate-800'}`}
                                  />
                                ))
                              ) : (
                                <span className="text-[10px] text-slate-500 italic">Unrated</span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-500 font-mono">• {rev.createTime}</span>
                          </div>
                        </div>
                      </div>

                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                        ID: {rev.id.slice(0, 8)}...
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed pl-10">
                      {rev.comment}
                    </p>

                    {rev.reviewReply ? (
                      <div className="ml-10 p-3.5 bg-slate-900 rounded-xl border border-slate-800 space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-semibold text-emerald-400 flex items-center space-x-1">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Response from the owner</span>
                          </span>
                          <span className="text-slate-500 text-[10px]">{rev.reviewReply.updateTime}</span>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed">
                          {rev.reviewReply.comment}
                        </p>
                      </div>
                    ) : (
                      <div className="ml-10 pt-2 space-y-2.5">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center space-x-2">
                            <button
                              type="button"
                              onClick={() => handleGenerateAiReply(rev)}
                              disabled={isGeneratingThis || isReplyingThis}
                              className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded-lg text-xs font-semibold shadow-sm transition disabled:opacity-50 ${
                                isNegative
                                  ? 'bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-200'
                                  : 'bg-gradient-to-r from-emerald-500/20 to-teal-500/20 hover:from-emerald-500/30 hover:to-teal-500/30 border border-emerald-500/40 text-emerald-300'
                              }`}
                            >
                              {isGeneratingThis ? (
                                <>
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                                  <span>Crafting AI Response...</span>
                                </>
                              ) : (
                                <>
                                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>AI Draft Response ({isNegative ? 'De-escalate' : aiTone})</span>
                                </>
                              )}
                            </button>

                            {isNegative && (
                              <button
                                type="button"
                                onClick={() => handleGenerateAiReply(rev, 'urgent')}
                                disabled={isGeneratingThis || isReplyingThis}
                                className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-rose-500 text-slate-950 font-bold text-xs hover:bg-rose-400 transition"
                                title="Draft an urgent service recovery response apologizing and offering direct resolution"
                              >
                                <Flame className="w-3 h-3 fill-current" />
                                <span>Urgent Recovery Draft</span>
                              </button>
                            )}
                          </div>

                          {draft && (
                            <button
                              type="button"
                              onClick={() => setReplyDrafts((prev) => ({ ...prev, [rev.id]: '' }))}
                              className="text-[11px] text-slate-500 hover:text-slate-300 underline"
                            >
                              Clear draft
                            </button>
                          )}
                        </div>

                        <div className="space-y-2">
                          <textarea
                            rows={3}
                            placeholder={
                              isNegative
                                ? "Draft a solution-oriented, respectful reply to address this customer's concern..."
                                : "Write or edit the official response to this customer before publishing..."
                            }
                            value={draft}
                            onChange={(e) => setReplyDrafts((prev) => ({ ...prev, [rev.id]: e.target.value }))}
                            disabled={isReplyingThis || isGeneratingThis}
                            className="w-full bg-slate-900 border border-slate-800 focus:border-emerald-500 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none transition leading-relaxed resize-none"
                          />

                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-slate-500 font-mono">
                              {draft.length} characters • Appears publicly on Google Maps & Search
                            </span>

                            <button
                              onClick={() => handleReplySubmit(rev.id)}
                              disabled={isReplyingThis || isGeneratingThis || !draft.trim()}
                              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition shadow-sm"
                            >
                              {isReplyingThis ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Send className="w-3.5 h-3.5" />
                              )}
                              <span>{isReplyingThis ? 'Posting to Google...' : 'Post Reply to Google'}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SUB-SECTION 5: Active Offers */}
      {activeSubSection === 'offers' && (
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Active Promotions & Offers
            </h3>
            <span className="text-xs text-slate-500 font-mono">Displayed on Google Maps & Search</span>
          </div>

          {offers.length === 0 ? (
            <div className="p-8 border border-dashed border-slate-800 rounded-xl text-center space-y-1">
              <p className="text-sm font-semibold text-slate-300">No active promotions running</p>
              <p className="text-xs text-slate-500">
                Create promotional posts or local discounts on Google Business Profile to attract nearby customers.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {offers.map((off) => (
                <div key={off.id} className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">{off.title}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono font-bold">
                      {off.couponCode}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">{off.discountSummary}</p>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[11px] text-slate-400">
                    <span>Valid: {off.validThrough}</span>
                    <span className="font-mono text-emerald-400 font-bold">{off.redeemedCount} Redeemed</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUB-SECTION 6: Raw Google Location Trace */}
      {activeSubSection === 'raw' && (
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-2">
                <Code className="w-4 h-4 text-emerald-400" />
                <span>Raw Google Location Payload (Audit Trace)</span>
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Exact unmodified JSON payload returned by Google Business Information API v1.
              </p>
            </div>
            <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              Verified Source of Truth
            </span>
          </div>

          <pre className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-96">
            {JSON.stringify(profile.rawGoogleLocation, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};
