// Settings Panel Component
// This is a comprehensive settings interface that lets users customize their app experience
// It handles themes, colors, timezone, and other preferences
import React, { useEffect, useMemo, useState } from 'react'

// This defines what settings our app can remember
// Think of it like a preferences file that saves how you like things set up

type AppSettings = {
  theme: 'auto' | 'light' | 'dark'  // What theme the user prefers
  primary: string                    // Their favorite color for buttons and highlights
  compact: boolean                   // Whether they want a more condensed interface
  animations: boolean                // Whether they want smooth transitions and effects
  timezone: string                   // Their local timezone for accurate time display
  telemetry: boolean                // Whether they're okay with anonymous usage data
}

// Default settings - what new users start with
const DEFAULTS: AppSettings = {
  theme: 'auto',        // Automatically match their device's light/dark preference
  primary: '#2563eb',   // Nice blue color
  compact: false,
  animations: true,
  timezone: typeof Intl !== 'undefined' ? (Intl as any).DateTimeFormat?.()?.resolvedOptions?.().timeZone || 'UTC' : 'UTC', // Try to detect their timezone
  telemetry: true,
}

// Where we save settings so they persist between app sessions
const STORAGE_KEY = 'app-settings-v1'

// Load saved settings from the browser's storage
function loadSettings(): AppSettings {
  try {
    if (typeof window === 'undefined') return DEFAULTS // Server-side safety check
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULTS // No saved settings yet
    return { ...DEFAULTS, ...(JSON.parse(raw) || {}) } // Merge saved settings with defaults
  } catch (e) {
    return DEFAULTS // If something goes wrong, use defaults
  }
}

// Save settings to browser storage
function saveSettings(s: AppSettings) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
}

// Check if a timezone string is valid (some browsers are picky about this)
function isValidTimeZone(tz: string) {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz }).format()
    return true
  } catch {
    return false
  }
}

// Common timezones that most people use - makes selection easier
const COMMON_TIMEZONES = [
  'UTC',
  'Europe/London',
  'Europe/Berlin',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Kolkata',
  'Australia/Sydney',
]

// Pre-defined color options with nice names
const COLOR_TOKENS: { [k: string]: string } = {
  'blue-600': '#2563eb',
  'indigo-600': '#4f46e5',
  'green-600': '#16a34a',
  'rose-600': '#e11d48',
  'teal-600': '#0d9488',
}

// Main Settings Panel Component
// This creates the entire settings interface that users interact with
export default function SettingsPanel({
  external,
  onSave,
}: {
  // Optional: if you want to connect this to external state management
  external?: { settings: Partial<AppSettings>; update: (patch: Partial<AppSettings>) => void }
  onSave?: (s: AppSettings) => void
}) {
  // Internal state for managing settings while user is making changes
  const [internal, setInternal] = useState<AppSettings>(() => loadSettings())
  const [detectedTZ, setDetectedTZ] = useState<string>(DEFAULTS.timezone)
  // State for showing legal document modals
  const [tosOpen, setTosOpen] = useState(false)
  const [ppOpen, setPpOpen] = useState(false)

  // When the component first loads, sync with external settings if provided
  useEffect(() => {
    if (external && external.settings) {
      setInternal((s) => ({ ...s, ...(external.settings as any) }))
    }
    // Try to automatically detect the user's timezone
    if (typeof Intl !== 'undefined') {
      try {
        const tz = (Intl as any).DateTimeFormat()?.resolvedOptions?.().timeZone || DEFAULTS.timezone
        setDetectedTZ(tz)
        setInternal((s) => ({ ...s, timezone: tz }))
      } catch {}
    }
  }, [external])

  // Show a preview of what time looks like in the selected timezone
  const previewTime = useMemo(() => {
    try {
      const opt: any = { timeZone: internal.timezone }
      const dt = new Date()
      return dt.toLocaleString(undefined, opt)
    } catch {
      return 'Invalid timezone'
    }
  }, [internal.timezone])

  // Function to automatically detect user's timezone
  const detectTimezone = async () => {
    try {
      const tz = (Intl as any).DateTimeFormat()?.resolvedOptions?.().timeZone || 'UTC'
      setInternal((s) => ({ ...s, timezone: tz }))
      setDetectedTZ(tz)
    } catch (e) {
      console.warn('Timezone detection failed', e)
    }
  }

  // Functions to change the primary color
  const changePrimaryHex = (hex: string) => setInternal((s) => ({ ...s, primary: hex }))
  const changePrimaryToken = (token: string) => changePrimaryHex(COLOR_TOKENS[token] || token)

  // Save all settings changes
  const handleSave = () => {
    if (external && external.update) {
      // If connected to external state management, update that
      external.update(internal)
    } else {
      // Otherwise, save to browser storage
      saveSettings(internal)
    }
    if (onSave) onSave(internal)
  }

  // Reset all settings back to defaults
  const handleReset = () => {
    setInternal(DEFAULTS)
    if (typeof localStorage !== 'undefined') localStorage.removeItem(STORAGE_KEY)
    if (external && external.update) external.update(DEFAULTS)
  }

  // Get a comprehensive list of timezones if the browser supports it
  const timezoneCandidates: string[] = useMemo(() => {
    try {
      const fn = (Intl as any).supportedValuesOf
      if (fn) return (Intl as any).supportedValuesOf('timeZone') as string[]
    } catch {}
    return COMMON_TIMEZONES
  }, [])

  return (
    <div className="bg-white p-6 rounded-lg shadow space-y-6 dark:bg-[var(--card)] dark:shadow-xl">
      {/* Settings panel header with save/reset buttons */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold dark:text-[var(--card-foreground)]">Settings</h3>
          <div className="text-sm text-gray-500 dark:text-[var(--muted-foreground)]">Appearance, time & other preferences</div>
        </div>
        <div className="flex gap-2">
          <button onClick={handleReset} className="px-3 py-1 rounded border hover:scale-105 transition-transform duration-200 dark:border-[var(--border)] dark:text-[var(--foreground)]">Reset</button>
          <button onClick={handleSave} className="px-3 py-1 rounded bg-[var(--primary)] text-white hover:scale-105 transition-transform duration-200">Save</button>
        </div>
      </div>

      {/* Theme selection - Auto, Light, or Dark */}
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium dark:text-[var(--foreground)]">Theme</div>
          <div className="text-xs text-gray-500 dark:text-[var(--muted-foreground)]">Auto respects your system preference</div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setInternal((s) => ({ ...s, theme: 'auto' }))} className={`px-3 py-1 rounded hover:scale-105 transition-transform duration-200 ${internal.theme === 'auto' ? 'bg-[var(--primary)] text-white' : ''} dark:bg-[var(--secondary)] dark:text-[var(--secondary-foreground)]`}>Auto</button>
          <button onClick={() => setInternal((s) => ({ ...s, theme: 'light' }))} className={`px-3 py-1 rounded hover:scale-105 transition-transform duration-200 ${internal.theme === 'light' ? 'bg-[var(--primary)] text-white' : ''} dark:bg-[var(--secondary)] dark:text-[var(--secondary-foreground)]`}>Light</button>
          <button onClick={() => setInternal((s) => ({ ...s, theme: 'dark' }))} className={`px-3 py-1 rounded hover:scale-105 transition-transform duration-200 ${internal.theme === 'dark' ? 'bg-[var(--primary)] text-white' : ''} dark:bg-[var(--secondary)] dark:text-[var(--secondary-foreground)]`}>Dark</button>
        </div>
      </div>

      {/* Primary color picker - preset colors plus custom hex input */}
      <div>
        <div className="font-medium dark:text-[var(--foreground)]">Primary color</div>
        <div className="text-xs text-gray-500 mb-2 dark:text-[var(--muted-foreground)]">Pick a preset or provide a custom hex</div>
        <div className="flex items-center gap-3">
          {/* Preset color buttons */}
          {Object.keys(COLOR_TOKENS).map((t) => (
            <button key={t} onClick={() => changePrimaryToken(t)} className={`p-2 rounded-md ring-offset-2 hover:scale-110 transition-transform duration-200 ${internal.primary === COLOR_TOKENS[t] ? 'ring-2' : ''} dark:ring-offset-[var(--card)]`} title={t}>
              <div style={{ width: 28, height: 20, borderRadius: 6, background: COLOR_TOKENS[t] }} />
            </button>
          ))}

          {/* Custom color picker and hex input */}
          <div className="flex items-center gap-2">
            <input type="color" value={internal.primary} onChange={(e) => changePrimaryHex(e.target.value)} className="w-10 h-8 p-0 border-0 hover:scale-105 transition-transform duration-200" />
            <input value={internal.primary} onChange={(e) => changePrimaryHex(e.target.value)} className="p-2 border rounded hover:scale-105 transition-transform duration-200 dark:border-[var(--input)] dark:bg-[var(--secondary)] dark:text-[var(--secondary-foreground)]" />
          </div>
        </div>
      </div>

      {/* UI preference toggles - Compact mode and Animations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium dark:text-[var(--foreground)]">Compact mode</div>
            <div className="text-xs text-gray-500 dark:text-[var(--muted-foreground)]">Reduce paddings for denser UI</div>
          </div>
          <input type="checkbox" checked={internal.compact} onChange={(e) => setInternal((s) => ({ ...s, compact: e.target.checked }))} className="hover:scale-105 transition-transform duration-200" />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium dark:text-[var(--foreground)]">Animations</div>
            <div className="text-xs text-gray-500 dark:text-[var(--muted-foreground)]">Subtle transitions and motion</div>
          </div>
          <input type="checkbox" checked={internal.animations} onChange={(e) => setInternal((s) => ({ ...s, animations: e.target.checked }))} className="hover:scale-105 transition-transform duration-200" />
        </div>
      </div>

      {/* Timezone selection with auto-detection */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium dark:text-[var(--foreground)]">Timezone</div>
            <div className="text-xs text-gray-500 dark:text-[var(--muted-foreground)]">Detected: <strong>{detectedTZ}</strong></div>
          </div>
          <div className="flex gap-2">
            <button onClick={detectTimezone} className="px-3 py-1 rounded border hover:scale-105 transition-transform duration-200 dark:border-[var(--border)]">Detect</button>
            <select value={internal.timezone} onChange={(e) => setInternal((s) => ({ ...s, timezone: e.target.value }))} className="p-2 border rounded hover:scale-105 transition-transform duration-200 dark:border-[var(--input)] dark:bg-[var(--secondary)] dark:text-[var(--secondary-foreground)]">
              {/* show candidates first */}
              {timezoneCandidates.slice(0, 20).map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
              <option disabled>──────────</option>
              {COMMON_TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </div>
        </div>

        {/* Preview of current time in selected timezone */}
        <div>
          <div className="font-medium dark:text-[var(--foreground)]">Preview local time</div>
          <div className="text-sm text-gray-500 dark:text-[var(--muted-foreground)]">Timezone: {internal.timezone} — {previewTime}</div>
        </div>
      </div>

      {/* Additional settings like telemetry and beta features */}
      <div>
        <div className="font-medium dark:text-[var(--foreground)]">Other</div>
        <div className="text-xs text-gray-500 dark:text-[var(--muted-foreground)]">Additional toggles you might find useful</div>
        <div className="mt-2 flex flex-col gap-2">
          <label className="flex items-center justify-between">
            <span>
              <div className="font-medium dark:text-[var(--foreground)]">Telemetry (anonymous)</div>
              <div className="text-xs text-gray-500 dark:text-[var(--muted-foreground)]">Send anonymous usage info (optional)</div>
            </span>
            <input type="checkbox" checked={internal.telemetry} onChange={(e) => setInternal((s) => ({ ...s, telemetry: e.target.checked }))} className="hover:scale-105 transition-transform duration-200" />
          </label>

          <label className="flex items-center justify-between">
            <span>
              <div className="font-medium dark:text-[var(--foreground)]">Beta features</div>
              <div className="text-xs text-gray-500 dark:text-[var(--muted-foreground)]">Enable experimental feature toggles</div>
            </span>
            <input type="checkbox" className="hover:scale-105 transition-transform duration-200" />
          </label>
        </div>
      </div>

      {/* Legal document access buttons */}
      <div>
        <div className="font-medium dark:text-[var(--foreground)]">Legal</div>
        <div className="text-xs text-gray-500 mb-2 dark:text-[var(--muted-foreground)]">View our legal documents</div>
        <div className="flex gap-4">
          <button onClick={() => setTosOpen(true)} className="px-4 py-2 rounded bg-[var(--primary-light)] text-[var(--primary)] hover:scale-105 transition-transform duration-200 dark:bg-[var(--accent)] dark:text-[var(--accent-foreground)]">Terms of Service</button>
          <button onClick={() => setPpOpen(true)} className="px-4 py-2 rounded bg-[var(--primary-light)] text-[var(--primary)] hover:scale-105 transition-transform duration-200 dark:bg-[var(--accent)] dark:text-[var(--accent-foreground)]">Privacy Policy</button>
        </div>
      </div>

      {/* Terms of Service Modal - shows when user clicks TOS button */}
      {tosOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in" onClick={() => setTosOpen(false)}>
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto transition-all duration-300 ease-in-out scale-95 dark:bg-[var(--card)]" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold dark:text-[var(--card-foreground)]">Terms of Service</h3>
              <button onClick={() => setTosOpen(false)} className="text-xl dark:text-[var(--foreground)]">&times;</button>
            </div>
            <p className="text-sm text-gray-600 dark:text-[var(--muted-foreground)]" style={{ whiteSpace: 'pre-wrap' }}>
              # Terms of Use

Last Updated: August 14, 2025

Welcome to FitnessPro! These Terms of Use (“Terms“) are a contract between you and FitnessPro Pty Ltd (“FitnessPro“ or “we“) and govern your access to and use of any FitnessPro website, mobile application or content (the “Site“) or any fitness, recreational, wellness, or other classes, experiences, activities, events, services, recordings, and/or products made available through FitnessPro (collectively, “Services“). Please read these Terms carefully before accessing and using the Site or Services.

## 1. Terms of Use

a) Acceptance of Terms. By accessing and/or using the Site or Services, or clicking any button to indicate your consent, you accept and agree to be bound by these Terms, just as if you had agreed to these Terms in writing. If you do not agree to these Terms, do not use the Site or any Services.

b) Amendment of Terms. FitnessPro may amend the Terms from time to time. Unless we provide a delayed effective date, all amendments will be effective upon FitnessPro posting the updated Terms. Your continued access to or use of the Site or Services after the posting of the amended Terms constitutes your consent to be bound by the Terms as amended.

c) Additional Terms. In addition to these Terms, certain plans, offers, products, services, elements or features may also be subject to additional terms, conditions, guidelines or rules which may be posted, communicated or modified by us or applicable third parties at any time. Your use of any such plan, offer, product, service, element or feature is subject to those additional terms and conditions, which are hereby incorporated by reference into the Terms, provided that in the event of any conflict between such additional terms and the Terms, the Terms shall control. The FitnessPro Privacy Policy is hereby incorporated by reference.

## 2. FitnessPro Platform

a) FitnessPro Platform. The FitnessPro platform enables consumers to reserve, schedule, purchase, access and attend a wide range of fitness, recreational and wellness Services offered and operated by fitness studios, gyms, trainers, venues or other third parties (collectively, “Venues“). FitnessPro itself is not a gymnasium, place of amusement or recreation, health club, facility, fitness studio or similar establishment and does not own, operate or control any of the Services that are offered at or through such facilities.

b) Membership Options. There are a number of ways to participate in FitnessPro, such as various subscription plans, promotional plans, and non-subscription purchases. These options consist of different services and features and may be subject to additional and differing conditions, prices, policies and limitations. We reserve the right to modify, terminate or otherwise amend our offered options and plans at any time in our discretion. From time to time we may permit non-subscribers to access certain services, content or features for a cost or at no cost. FitnessPro makes no commitment on the quantity, availability, type or frequency at which such services, content and features will be available to non-subscribers and may modify, discontinue, remove or suspend access at any time and for any reason in our sole discretion.

c) Subscription Plans. To enjoy full access to the Site and Services, you need to sign up for a subscription. A subscription starts on the date that you sign up for a subscription and submit payment via a valid Payment Method (defined below) or reactivate a pre-existing subscription. Unless we otherwise communicate a different time period to you at the time of sign up or otherwise (such as a multi-month commitment plan), each billing cycle is one month in length (a “Subscription Cycle“). Your FitnessPro subscription automatically renews each month, and we will automatically bill the monthly subscription fee to your Payment Method each month, until your subscription is cancelled or terminated. You must provide us with a current, valid, accepted method of payment (“Payment Method“). We may update the accepted methods from time to times. If you add a subscription to your base subscription or if you upgrade or downgrade to a different subscription, all such subscriptions will be governed by these Terms and will continue indefinitely until canceled or terminated.

d) Use of Credits. Depending on the subscription plan you choose and purchase, you may be allotted credits to be used solely to book Services each Subscription Cycle. You can choose how you use your credits across the various Services available to you.

Credits expire at the end of each Subscription Cycle, meaning that any credits you don’t use during the applicable Subscription Cycle will not roll over into future months, unless we expressly communicate otherwise. If your subscription is canceled or terminated your unused credits will expire immediately. There will be no refund or payment for any unused amount. When your cycle automatically renews for the next month, you’ll automatically receive your new allotment of credits. If you have any questions about how to use your credits, please contact us and we can help you.

Credits have no cash value or any other value outside of the FitnessPro platform and are not redeemable for cash. You may not transfer, trade, gift or otherwise exchange FitnessPro credits.

e) Service Availability and Allocation. The exact number and type of Services you can access during any Subscription Cycle will depend on the number of credits needed to book the particular Services you select. The number of credits needed to book a particular Service will vary and is determined based on a variety of factors, including but not limited to Venue requirements, time of day, equipment, facilities, the number of times you've visited a venue in the cycle, location, pricing, popularity and other characteristics. Note that credits needed to book Services also vary from city to city. FitnessPro does not guarantee the availability of particular Venues, locations, Services, inventory, spots or other features, and availability may change over time and at any time. FitnessPro takes certain steps to release, promote and otherwise make available spots and inventory at varying times and in an ongoing and evolving way.

f) Digital Services. FitnessPro may allow access to audio or video digital Services from your device, via live stream and/or on demand. To access these digital Services, you need to comply with certain technical and hardware requirements. Certain digital services may involve your participation through connected devices. If you participate in such digital Services through a connected device, we may collect metrics to calculate rankings, display records, and improve the Site and our services.

3. Eligibility

You must be at least 18 years of age or the age of legal majority in your jurisdiction to use the Site and Services. By using the Site and Services, you represent and warrant that you meet all eligibility requirements.

4. Payment and Billing

a) Payment Method. You must provide a valid Payment Method to use subscription services. You authorize us to charge any Payment Method associated with your account.

b) Billing. Subscription fees are billed in advance on a monthly basis. Fees are non-refundable except as required by law.

c) Cancellation. You can cancel your subscription at any time, but FitnessPro does not refund or credit for partially used periods.

5. User Content

You retain ownership of content you submit, but grant FitnessPro a worldwide, non-exclusive license to use, reproduce, and display such content for providing the Services.

6. Prohibited Conduct

You agree not to misuse the Services, violate laws, or infringe rights.

7. Termination

We may terminate your access for breach of these Terms. Upon termination, your right to use the Services ceases.

8. Limitation of Liability

To the maximum extent permitted by Australian law, FitnessPro shall not be liable for any indirect, incidental, special, consequential or punitive damages, or any loss of profits or revenues, whether incurred directly or indirectly, or any loss of data, use, goodwill, or other intangible losses, resulting from (a) your access to or use of or inability to access or use the Services; (b) any conduct or content of any third party on the Services; (c) any content obtained from the Services; and (d) unauthorized access, use or alteration of your transmissions or content. In no event shall the aggregate liability of FitnessPro exceed the greater of one hundred dollars (AUD $100) or the amount you paid FitnessPro, if any, in the past six months for the Services giving rise to the claim. The limitations of this subsection shall apply to any theory of liability, whether based on warranty, contract, statute, tort (including negligence) or otherwise, and whether or not FitnessPro has been informed of the possibility of any such damage, and even if a remedy set forth herein is found to have failed of its essential purpose.

Note: FitnessPro is not responsible for any injuries or health issues arising from use of the Services. Users should consult a medical professional before engaging in any fitness activities.

9. Governing Law

These Terms shall be governed by the laws of the State of New South Wales, Australia, without regard to its conflict of law provisions.

10. Changes to Terms

We may update these Terms from time to time. Continued use after changes constitutes acceptance.

Contact Us: For questions, contact support@fitnesspro.app
            </p>
          </div>
        </div>
      )}

      {/* Privacy Policy Modal - shows when user clicks Privacy Policy button */}
      {ppOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in" onClick={() => setPpOpen(false)}>
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto transition-all duration-300 ease-in-out scale-95 dark:bg-[var(--card)]" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold dark:text-[var(--card-foreground)]">Privacy Policy</h3>
              <button onClick={() => setPpOpen(false)} className="text-xl dark:text-[var(--foreground)]">&times;</button>
            </div>
            <p className="text-sm text-gray-600 dark:text-[var(--muted-foreground)]" style={{ whiteSpace: 'pre-wrap' }}>
              ## Australian Privacy Policy

Your privacy is important to us. It is FitnessPro's policy to respect your privacy and comply with any applicable law and regulation regarding any personal information we may collect about you, including across our app, FitnessPro, and other sites we own and operate.

This policy is effective as of 14 August 2025 and was last updated on 14 August 2025.

### Information We Collect

Information we collect includes both information you knowingly and actively provide us when using or participating in any of our services and promotions, and any information automatically sent by your devices in the course of accessing our products and services.

### Log Data

When you visit our app, our servers may automatically log the standard data provided by your web browser. It may include your device’s Internet Protocol (IP) address, your browser type and version, the pages you visit, the time and date of your visit, the time spent on each page, other details about your visit, and technical details that occur in conjunction with any errors you may encounter.

Please be aware that while this information may not be personally identifying by itself, it may be possible to combine it with other data to personally identify individual persons.

### Personal Information

We may ask for personal information which may include one or more of the following:

- Name
- Email address
- Social media profiles
- Date of birth
- Phone/mobile number
- Home/mailing address
- Health and fitness data (e.g., workout logs, meal plans, progress metrics)

### Legitimate Reasons for Processing Your Personal Information

We only collect and use your personal information when we have a legitimate reason for doing so. In which instance, we only collect personal information that is reasonably necessary to provide our services to you.

### Collection and Use of Information

We may collect personal information from you when you do any of the following on our app:

* Enter any of our competitions, contests, sweepstakes, and surveys
* Sign up to receive updates from us via email or social media channels
* Use a mobile device or web browser to access our content
* Contact us via email, social media, or on any similar technologies
* When you mention us on social media

We may collect, hold, use, and disclose information for the following purposes, and personal information will not be further processed in a manner that is incompatible with these purposes:

* to enable you to customise or personalise your experience of our app
* to contact and communicate with you
* for analytics, market research, and business development, including to operate and improve our app, associated applications, and associated social media platforms
* for advertising and marketing, including to send you promotional information about our products and services and information about third parties that we consider may be of interest to you
* to consider your employment application
* to enable you to access and use our app, associated applications, and associated social media platforms
* for internal record keeping and administrative purposes
* to run competitions, sweepstakes, and/or offer additional benefits to you
* to comply with our legal obligations and resolve any disputes that we may have
* for security and fraud prevention, and to ensure that our sites and apps are safe, secure, and used in line with our terms of use
* to provide fitness and health tracking services, including sharing data with trainers or clients as authorized

Please be aware that we may combine information we collect about you with general information or research data we receive from other trusted sources.

### Security of Your Personal Information

When we collect and process personal information, and while we retain this information, we will protect it within commercially acceptable means to prevent loss and theft, as well as unauthorised access, disclosure, copying, use, or modification.

Although we will do our best to protect the personal information you provide to us, we advise that no method of electronic transmission or storage is 100% secure, and no one can guarantee absolute data security. We will comply with laws applicable to us in respect of any data breach.

You are responsible for selecting any password and its overall security strength, ensuring the security of your own information within the bounds of our services.

### How Long We Keep Your Personal Information

We keep your personal information only for as long as we need to. This time period may depend on what we are using your information for, in accordance with this privacy policy. If your personal information is no longer required, we will delete it or make it anonymous by removing all details that identify you.

However, if necessary, we may retain your personal information for our compliance with a legal, accounting, or reporting obligation or for archiving purposes in the public interest, scientific, or historical research purposes or statistical purposes.

### Disclosure of Personal Information to Third Parties

We may disclose personal information to:

* a parent, subsidiary, or affiliate of our company
* third party service providers for the purpose of enabling them to provide their services, for example, IT service providers, data storage, hosting and server providers, advertisers, or analytics platforms
* our employees, contractors, and/or related entities
* our existing or potential agents or business partners
* sponsors or promoters of any competition, sweepstakes, or promotion we run
* courts, tribunals, regulatory authorities, and law enforcement officers, as required by law, in connection with any actual or prospective legal proceedings, or in order to establish, exercise, or defend our legal rights
* third parties, including agents or sub-contractors, who assist us in providing information, products, services, or direct marketing to you third parties to collect and process data

### International Transfers of Personal Information

The personal information we collect is stored and/or processed where we or our partners, affiliates, and third-party providers maintain facilities. Please be aware that the locations to which we store, process, or transfer your personal information may not have the same data protection laws as the country in which you initially provided the information. If we transfer your personal information to third parties in other countries: (i) we will perform those transfers in accordance with the requirements of applicable law; and (ii) we will protect the transferred personal information in accordance with this privacy policy.

### Your Rights and Controlling Your Personal Information

You always retain the right to withhold personal information from us, with the understanding that your experience of our app may be affected. We will not discriminate against you for exercising any of your rights over your personal information. If you do provide us with personal information you understand that we will collect, hold, use and disclose it in accordance with this privacy policy. You retain the right to request details of any personal information we hold about you.

If we receive personal information about you from a third party, we will protect it as set out in this privacy policy. If you are a third party providing personal information about somebody else, you represent and warrant that you have such person’s consent to provide the personal information to us.

If you have previously agreed to us using your personal information for direct marketing purposes, you may change your mind at any time. We will provide you with the ability to unsubscribe from our email-database or opt out of communications. Please be aware we may need to request specific information from you to help us confirm your identity.

If you believe that any information we hold about you is inaccurate, out of date, incomplete, irrelevant, or misleading, please contact us using the details provided in this privacy policy. We will take reasonable steps to correct any information found to be inaccurate, incomplete, misleading, or out of date.

If you believe that we have breached a relevant data protection law and wish to make a complaint, please contact us using the details below and provide us with full details of the alleged breach. We will promptly investigate your complaint and respond to you, in writing, setting out the outcome of our investigation and the steps we will take to deal with your complaint. You also have the right to contact a regulatory body or data protection authority in relation to your complaint.

### Use of Cookies

We use “cookies” to collect information about you and your activity across our site. A cookie is a small piece of data that our website stores on your computer, and accesses each time you visit, so we can understand how you use our site. This helps us serve you content based on preferences you have specified.

### Limits of Our Policy

Our app may link to external sites that are not operated by us. Please be aware that we have no control over the content and policies of those sites, and cannot accept responsibility or liability for their respective privacy practices.

### Changes to This Policy

At our discretion, we may change our privacy policy to reflect updates to our business processes, current acceptable practices, or legislative or regulatory changes. If we decide to change this privacy policy, we will post the changes here at the same link by which you are accessing this privacy policy.

If required by law, we will get your permission or give you the opportunity to opt in to or opt out of, as applicable, any new uses of your personal information.

### Contact Us

For any questions or concerns regarding your privacy, you may contact us using the following details:

FitnessPro Support

support@fitnesspro.app
            </p>
          </div>
        </div>
      )}
    </div>
  )
}