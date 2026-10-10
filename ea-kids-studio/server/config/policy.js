// YouTube / AdSense policy facts used by the compliance engine and the monetization checklist.
// IMPORTANT: policies change. Every fact carries its source URL and a verification status.
//   status 'search_snippet'  → seen in snippets of the official page on `checkedAt` via web search (the official pages
//                              themselves could not be opened from the build environment). Re-check before relying on it.
//   status 'conflicting'     → sources disagreed when checked; do not rely on it.
//   status 'unverified'      → recalled / commonly reported; no official source confirmed.
// Owners can override any value in Settings → Monetization (stored in the database).
const CHECKED = '2026-10-10';
const fact = (value, status, source, note = '') => ({ value, status, source, checkedAt: CHECKED, note });

export const POLICY = {
  version: 1,
  checkedAt: CHECKED,
  disclaimer: 'These are reference facts, not legal or financial advice, and they change. Confirm in YouTube Studio → Earn and the AdSense Payments page before acting. EA KIDS Studio never promises monetization, a specific RPM, views or income.',

  ypp: {
    full: {
      subscribers: fact(1000, 'search_snippet', 'https://support.google.com/youtube/answer/72851'),
      publicWatchHours12m: fact(4000, 'search_snippet', 'https://support.google.com/youtube/answer/72851', 'Shorts watch hours do not count toward the 4,000 hours.'),
      publicShortsViews90d: fact(10_000_000, 'search_snippet', 'https://support.google.com/youtube/answer/72851', 'Alternative to the watch-hours route (with 1,000 subscribers).'),
    },
    earlyAccess: {
      subscribers: fact(500, 'search_snippet', 'https://support.google.com/youtube/answer/72851', 'Early tier: fan-funding/shopping features, not ad revenue.'),
      publicUploads90d: fact(3, 'search_snippet', 'https://support.google.com/youtube/answer/72851'),
      publicWatchHours12m: fact(3000, 'search_snippet', 'https://support.google.com/youtube/answer/72851'),
      publicShortsViews90d: fact(3_000_000, 'search_snippet', 'https://support.google.com/youtube/answer/72851'),
    },
    upcomingChange: fact({ effective: '2027-02-01', publicWatchHours365d: 8000, publicShortsViews90d: 20_000_000, appliesTo: 'new applicants' }, 'search_snippet', 'https://blog.youtube/news-and-events/youtube-partner-program-updates-2027-new-opportunities-earn/', 'Reported by a YouTube Blog result; verify the exact figures and dates before planning around them.'),
    otherRequirements: fact(['Follow the channel monetization policies', 'No active Community Guidelines strikes', '2-Step Verification enabled on the Google Account', 'Link an AdSense account', 'Meeting thresholds does not guarantee acceptance (manual review)'], 'search_snippet', 'https://support.google.com/youtube/answer/72851'),
  },

  originality: {
    inauthenticContent: fact('From 15 July 2025 YouTube’s "repetitious content" policy is called "inauthentic content": mass-produced or repetitive content — including template-based or AI-generated videos with little variation and no original insight — can lose monetization for the whole channel.', 'search_snippet', 'https://support.google.com/youtube/answer/1311392', 'Directly relevant to template-driven kids channels: vary scripts, add original teaching ideas, characters and stories.'),
    syntheticDisclosure: fact('Creators must disclose realistic altered or synthetic content (e.g. realistic people/events that did not happen). Unrealistic animation and production help such as scripting or captions do not need disclosure. YouTube may also label content automatically (e.g. when C2PA metadata is present).', 'search_snippet', 'https://support.google.com/youtube/answer/14328491', 'EA KIDS videos are stylised cartoons, so disclosure is normally not required — but the owner decides. If you use realistic AI footage or voices of real people, disclose.'),
  },

  madeForKids: {
    restrictedFeatures: fact(['Comments', 'Personalized ads (contextual ads still run)', 'Notifications', 'Live chat / Super Chat', 'Channel memberships'], 'search_snippet', 'https://support.google.com/youtube/answer/9527654', 'Marking content made for kids may reduce revenue because ads are not personalised.'),
    youtubeKidsApp: fact('The YouTube Kids app is a separate, curated app. Being made for kids does not guarantee inclusion; there is no application form — selection uses human review, curated playlists and algorithmic filtering.', 'search_snippet', 'https://support.google.com/youtube/answer/9632097'),
    ownerResponsibility: fact('You set the audience yourself, and YouTube may override it. Do not mark kids content "not made for kids" to avoid the restrictions.', 'search_snippet', 'https://support.google.com/youtube/answer/9527654'),
  },

  payments: {
    thresholdUsd: fact(100, 'search_snippet', 'https://support.google.com/adsense/answer/1709871', 'Payment threshold depends on your reporting currency; the Iraqi dinar equivalent was not found. Check your AdSense Payments page.'),
    methodSelectionThresholdUsd: fact(10, 'search_snippet', 'https://support.google.com/youtube/answer/14727140', 'Earnings needed before you can select a payment method.'),
    iraq: fact({ check: true, eft: false, wire: true, hyperwallet: false }, 'search_snippet', 'https://support.google.com/youtube/answer/14728152', 'Table may be outdated; confirm under AdSense → Payments → Payment methods for your account.'),
    currency: fact('USD or EUR, set by Google per country; cannot be changed. Iraq’s currency was not confirmed.', 'unverified', 'https://support.google.com/youtube/answer/14728152'),
    wireDetails: fact('Bank account must be in your own country; only your bank can confirm it can receive international wires; allow up to ~15 business days; your bank and intermediaries may charge fees and apply their own FX rates.', 'search_snippet', 'https://support.google.com/adsense/answer/6025222', 'Ask your Iraqi bank about SWIFT/BIC, incoming-wire fees and conversion rates before choosing it.'),
    taxInfo: fact('AdSense asks for tax information (e.g. Google may collect US tax info from YouTube creators outside the US). Complete it in AdSense → Payments → Manage settings.', 'unverified', 'https://support.google.com/youtube/answer/10391316', 'Verify requirements for your country; consult a tax adviser. Never use another person’s identity or details.'),
    identity: fact('PIN verification by postal mail and/or identity & address verification may be required by AdSense.', 'unverified', 'https://support.google.com/adsense/answer/1709858', 'Use your real name and address exactly as on your ID/bank account.'),
  },

  api: {
    videosInsertQuota: fact('Sources conflict: the current reference reports its own "Video Uploads" quota bucket (default ≈100 uploads/day since June 2026); older material says 1,600 units of the 10,000/day default.', 'conflicting', 'https://developers.google.com/youtube/v3/docs/videos/insert', 'Check the quota in Google Cloud Console → APIs & Services → YouTube Data API v3 → Quotas.'),
    unverifiedProjectPrivate: fact('Older notices: videos uploaded via videos.insert from unverified API projects created after 28 July 2020 are locked to private until the project passes an audit. The current reference says this restriction no longer applies. Sources conflict.', 'conflicting', 'https://developers.google.com/youtube/v3/docs/videos/insert', 'EA KIDS Studio always shows the privacy status returned by YouTube after upload; if the video comes back private, request an API compliance audit or publish it manually in Studio.'),
    thumbnails: fact('Custom thumbnails need a verified YouTube account (phone verification); images up to 2 MB, 16:9 (1280×720 recommended); PNG/JPEG.', 'unverified', 'https://developers.google.com/youtube/v3/docs/thumbnails/set'),
  },
};

/** The monetization readiness checklist. `kind: 'metric'` items take a number; others are yes/no. */
export const READINESS = [
  { id: 'channel_created', section: 'Channel basics', kind: 'bool', text: 'YouTube channel created with the EA KIDS name, avatar and banner (see Brand).' },
  { id: 'two_step', section: 'Channel basics', kind: 'bool', text: '2-Step Verification is enabled on the Google Account.' },
  { id: 'phone_verified', section: 'Channel basics', kind: 'bool', text: 'Channel phone-verified (needed for custom thumbnails and longer videos).' },
  { id: 'subs', section: 'YPP thresholds', kind: 'metric', text: 'Subscribers (current)', policy: 'ypp.full.subscribers' },
  { id: 'watch_hours', section: 'YPP thresholds', kind: 'metric', text: 'Public watch hours, last 12 months (current)', policy: 'ypp.full.publicWatchHours12m' },
  { id: 'shorts_views', section: 'YPP thresholds', kind: 'metric', text: 'Public Shorts views, last 90 days (current)', policy: 'ypp.full.publicShortsViews90d' },
  { id: 'upcoming_check', section: 'YPP thresholds', kind: 'bool', text: 'I checked whether the announced threshold change (1 Feb 2027) affects my application timing.' },
  { id: 'no_strikes', section: 'Policies', kind: 'bool', text: 'No active Community Guidelines strikes.' },
  { id: 'original_content', section: 'Policies', kind: 'bool', text: 'My videos are original and varied — scripts, stories and teaching ideas differ between videos (not template re-skins).' },
  { id: 'advertiser_friendly', section: 'Policies', kind: 'bool', text: 'Content follows advertiser-friendly guidelines and the made-for-kids rules.' },
  { id: 'licences', section: 'Policies', kind: 'bool', text: 'Every voice, music track, sound and image is original or licensed for commercial use, with proof saved.' },
  { id: 'audience_set', section: 'Policies', kind: 'bool', text: 'Audience (made for kids) is set correctly on every video.' },
  { id: 'adsense_linked', section: 'AdSense & payments', kind: 'bool', text: 'AdSense for YouTube account created/linked in my own name.' },
  { id: 'identity_verified', section: 'AdSense & payments', kind: 'bool', text: 'Identity / address verification completed (real details only).' },
  { id: 'pin', section: 'AdSense & payments', kind: 'bool', text: 'Address PIN or equivalent verification completed, if requested.' },
  { id: 'tax_info', section: 'AdSense & payments', kind: 'bool', text: 'Tax information submitted where required.' },
  { id: 'payment_method', section: 'AdSense & payments', kind: 'bool', text: 'Payment method added: wire transfer to a bank account in my own country (Iraq lists wire; confirm in AdSense).' },
  { id: 'bank_swift', section: 'AdSense & payments', kind: 'bool', text: 'My bank confirmed it can receive international wires; I have its SWIFT/BIC, incoming-wire fees and conversion rate.' },
  { id: 'currency', section: 'AdSense & payments', kind: 'bool', text: 'I understand the payout currency (USD/EUR per Google) and bank conversion to dinar.' },
  { id: 'threshold', section: 'AdSense & payments', kind: 'bool', text: 'I know my payment threshold shown in AdSense (about $100-equivalent; varies by currency).' },
];
