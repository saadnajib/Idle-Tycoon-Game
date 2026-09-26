# Publishing Ribbon to the App Store and Google Play

Ribbon is wrapped with Capacitor 8. The repo already contains:

- `capacitor.config.json`: app id `com.saadnajib.ribbon`, name `Ribbon`, web dir `www`, dark splash and status bar.
- `ios/`: the Xcode project. Capacitor 8 uses **Swift Package Manager**, so there is no Podfile and CocoaPods is not needed. Portrait only, display name "Ribbon", `ITSAppUsesNonExemptEncryption = NO`.
- `android/`: the Gradle project. Portrait only, label "Ribbon", target SDK 36.
- `assets/`: the source icon (`icon.png`, 1024x1024, no alpha) and splash (`splash.png`, 2732x2732). These were made by `npm run icons`. `npm run assets` has already generated every iOS and Android icon and splash size from them.

`index.html` is still the only source file for the game. `npm run build` copies it to `www/`, which is not in git. **Run `npm run sync` after every change to `index.html`.**

Work through the steps below in order, on a Mac.

---

## 1. Prerequisites

| What | Notes | Time |
|---|---|---|
| Apple Developer Program | https://developer.apple.com/programs/, $99 per year. Individuals are usually approved in 1 to 2 days. Organizations need a D-U-N-S number, which can add 1 to 2 weeks. | 1 to 2 days |
| Xcode (latest stable) | From the Mac App Store. Open it once to install the iOS platform and simulators. | 1 hour |
| Node.js 20 or newer | `node -v`. Capacitor 8's CLI needs a current LTS. | minutes |
| CocoaPods | **Not required.** The project uses Swift Package Manager. Install it (`brew install cocoapods`) only if you later add a plugin that is CocoaPods-only. | n/a |
| Android Studio (for Play only) | Includes the Android SDK and a JDK. | 1 hour |

## 2. Clone and build

```sh
git clone <repo> && cd <repo>
npm i
npm run sync          # copies index.html to www/, then runs `cap sync` for iOS and Android
npm run ios           # opens ios/App/App.xcodeproj in Xcode
```

Xcode resolves the Swift packages (Capacitor and the plugins) the first time it opens the project. Wait until "Resolving Package Graph" finishes. If you ever switch to CocoaPods, you then need `cd ios/App && pod install`. The current project does not.

Run the app on a simulator (for example "iPhone 16 Pro"), then on a real device. Check that:

- the splash screen goes away as soon as the game draws its first frame,
- a death triggers a heavy haptic on a real device (the simulator has no haptics),
- the app stays in portrait when you rotate the device,
- your best score survives killing and relaunching the app.

## 3. Signing

In Xcode, select the **App** target, then **Signing & Capabilities**:

1. Check **Automatically manage signing**.
2. **Team**: your Apple Developer team.
3. **Bundle Identifier**: `com.saadnajib.ribbon`. It is already set. If Xcode says the identifier is taken, pick another one and change `appId` in `capacitor.config.json` to match.
4. Under **General**, set **Version** to `1.0.0` and **Build** to `1`. Increase Build by one for every upload.
5. Optional: **General > Supported Destinations** includes iPad. If you remove iPad, you do not need iPad screenshots. If you keep it, the app runs full screen in portrait on iPad (`UIRequiresFullScreen` is set).

## 4. Before submission: MUST DO

### 4a. Replace the monetization mocks, or remove them

The `Monetization` object in `index.html` is a **mock**:

- `showRewarded` shows a fake "Loading ad…" bar and then grants the continue. No real ad is shown.
- `purchase` shows "Buy · $1.99" and then unlocks **Ribbon Styles** (Aurora and Ember) **without any payment**. `restorePurchases` just re-reads localStorage.

Apple rejects this as it stands:

- **Guideline 2.1 (App Completeness)**: placeholder and demo features, including a fake ad and a fake store, count as an incomplete app.
- **Guideline 3.1.1 (In-App Purchase)**: digital content that is offered for a price has to be sold through Apple's In-App Purchase. A "$1.99" button that unlocks content for free, or any other unlock path, is not allowed.

Choose **one** of the options below.

#### Option A: Ship v1 with no monetization (fastest path to approval, recommended)

In `index.html`:

1. Delete the `#btnCont` button ("Trim tail & continue") from the game-over card, its click handler (`el.btnCont.addEventListener…showRewarded`), the `el.btnCont.hidden = …` line in `UI`, and `'btnCont'` from the `el` id list. The only thing lost is the once-per-run continue.
2. Delete `#btnBuy` ("Ribbon Styles pack $1.99") and `#btnRestore`, their click handlers, the `el.btnBuy.hidden = …` line in `refreshShop`, and both ids from the `el` list.
3. Make all three palettes free. The simplest change: in the swatch click handler, drop the `!SV.owned[SKU_STYLES]` purchase branch and call `setPalette(pal)` directly. Also make `load()` accept any known palette. Keep the palettes. They are part of what makes this more than a minimal clone (see section 9).
4. Delete the `Monetization` object once nothing references it.
5. Test in a browser, then `npm run sync`.

With no ad or analytics SDK, the privacy label is **"Data Not Collected"**, no privacy policy page is strictly required (Apple still asks for a URL, see 5c), and there are no IAP products to review.

#### Option B: Real rewarded ads with AdMob

```sh
npm i @capacitor-community/admob
npx cap sync
```

Map `showRewarded` onto the plugin. Keep the same signature so the game code does not change:

```js
async showRewarded(id, onReward, onDismiss) {
  if (this.busy) return; this.busy = true;
  const AdMob = window.Capacitor.Plugins.AdMob;
  let rewarded = false;
  // RewardAdPluginEvents.Rewarded / .Dismissed from the plugin, as plain strings for the global bridge
  const h1 = await AdMob.addListener('onRewardedVideoAdReward', () => { rewarded = true; });
  const h2 = await AdMob.addListener('onRewardedVideoAdDismissed', () => {
    h1.remove(); h2.remove(); this.busy = false;
    rewarded ? onReward && onReward(id) : onDismiss && onDismiss(id);
  });
  try {
    await AdMob.prepareRewardVideoAd({ adId: 'ca-app-pub-XXXX/YYYY' });   // your rewarded ad unit id
    await AdMob.showRewardVideoAd();
  } catch (e) { h1.remove(); h2.remove(); this.busy = false; onDismiss && onDismiss(id); }
}
```

Call `AdMob.initialize()` once at startup, and gather consent first (the plugin wraps Google UMP: `requestConsentInfo` and `showConsentForm`). Check the plugin README for the exact event names in the version you install.

Native setup:

- iOS `Info.plist`: add `GADApplicationIdentifier` (your AdMob **app** id) and the `SKAdNetworkItems` list from Google's docs. Add `NSUserTrackingUsageDescription` if you request App Tracking Transparency for personalized ads.
- Android `AndroidManifest.xml`: add `<meta-data android:name="com.google.android.gms.ads.APPLICATION_ID" android:value="ca-app-pub-…~…"/>` inside `<application>`.
- Use Google's **test** ad unit ids until the app is live. Tapping your own live ads can get the AdMob account banned.

#### Option C: Real in-app purchase with RevenueCat

1. In App Store Connect, go to **Monetization > In-App Purchases** and create a **Non-Consumable** with product id `ribbon_styles_pack` (this matches `SKU_STYLES` in `index.html`). Give it a price, a display name, a review screenshot of the palettes, and add it to the version you submit.
2. Create a RevenueCat project, add the iOS app and product, and create an entitlement such as `styles`.
3. Install and sync:

```sh
npm i @revenuecat/purchases-capacitor
npx cap sync
```

4. Map the mock methods onto the plugin:

```js
// startup (once):  await Purchases.configure({ apiKey: 'appl_…' });
async purchase(sku, onSuccess) {
  if (this.busy) return; this.busy = true;
  try {
    const { products } = await Purchases.getProducts({ productIdentifiers: [sku], type: 'NON_SUBSCRIPTION' });
    const { customerInfo } = await Purchases.purchaseStoreProduct({ product: products[0] });
    if (customerInfo.entitlements.active.styles) { SV.owned[sku] = true; save(); onSuccess && onSuccess(sku); }
  } catch (e) { /* user cancelled or the purchase failed: grant nothing */ }
  this.busy = false;
},
async restorePurchases(onDone) {
  if (this.busy) return; this.busy = true;
  let list = [];
  try {
    const { customerInfo } = await Purchases.restorePurchases();
    if (customerInfo.entitlements.active.styles) { SV.owned[SKU_STYLES] = true; save(); list = [SKU_STYLES]; }
  } catch (e) { /* ignore */ }
  this.busy = false; onDone && onDone(list);
},
```

Here `Purchases` is `window.Capacitor.Plugins.Purchases`. Keep the **Restore** button: Apple requires a restore option for non-consumables.

Also sign the **Paid Apps agreement** and complete the tax and banking forms under **App Store Connect > Business**. IAPs cannot go live until you do.

### 4b. Privacy manifest

Apple requires a privacy manifest for "required reason" APIs. Capacitor and its official plugins ship their own. If App Store Connect emails you about a missing reason after upload, add `PrivacyInfo.xcprivacy` to the App target in Xcode (File > New > File > App Privacy) and declare `NSPrivacyAccessedAPICategoryUserDefaults` with reason `CA92.1`. The game itself stores its save in WebView `localStorage` and does not use Preferences yet.

### 4c. Final device check

Do a full pass on a real iPhone: play, die, open the game-over card, test mute, and background then foreground the app. The run must pause when the app goes to the background. There should be no mock text anywhere in the UI.

## 5. App Store Connect

1. **Create the app**: https://appstoreconnect.apple.com, then **Apps > + > New App**. Platform iOS, name "Ribbon" (if the name is taken, try something like "Ribbon: One Tap"), primary language, bundle id `com.saadnajib.ribbon`, SKU `ribbon-ios-1`.
2. **Screenshots** (PNG or JPEG, portrait, no alpha, 1 to 10 per size):
   - iPhone 6.9"/6.7": 1320x2868 or 1290x2796 (for example the iPhone 16 Pro Max simulator)
   - iPhone 6.5": 1284x2778 or 1242x2688
   - iPad 13": 2064x2752 or 2048x2732, only if iPad stays enabled
   - To capture them: run the simulator, then **File > Save Screen** (Cmd+S). Show the title screen, mid-run with a long glowing ribbon, a near-miss graze combo, and the game-over card with the palettes.
3. **Description, keywords, support URL**: the support URL is required. A GitHub Pages page or a simple site is fine.
4. **App Privacy (nutrition labels)**:
   - **No SDKs (Option A)**: answer "No, we do not collect data from this app". The label reads **Data Not Collected**.
   - **With AdMob**: this changes. You must declare at least **Identifiers > Device ID** (the advertising identifier), **Usage Data > Advertising Data / Product Interaction**, **Diagnostics > Crash / Performance Data**, and **Location > Coarse Location** (derived from IP). They are used for **Third-Party Advertising** and **Analytics**. If ads are personalized they are "used to track you", which needs the ATT prompt. Follow Google's "Data disclosure" page for the SDK version you ship.
   - **With RevenueCat only**: declare **Purchases > Purchase History** (App Functionality, not linked to identity unless you set user ids) and **Identifiers > User ID** if you log users in.
5. **Privacy Policy URL**: App Store Connect requires one for every app. It is essential if ads are present. Host a short page, for example GitHub Pages, that says what is collected: nothing, or the AdMob and RevenueCat data above with links to their policies.
6. **Age rating**: fill in the questionnaire. There is no violence, no user-generated content, no gambling and no web access, so it should come out at the lowest rating (4+). If ads are present, answer the advertising question truthfully and set AdMob's content filter to match.
7. **Export compliance**: already answered by `ITSAppUsesNonExemptEncryption = NO` in `Info.plist`, so the app uses no non-exempt encryption. If asked anyway: "None of the algorithms mentioned above".
8. **Pricing**: Free. Availability: all territories, or the ones you choose.

## 6. Archive and TestFlight

1. In Xcode, set the run destination to **Any iOS Device (arm64)**.
2. **Product > Archive**. When the Organizer opens, choose **Distribute App > App Store Connect > Upload**.
3. Processing takes 5 to 30 minutes. The build then shows under **TestFlight**. Answer the export compliance prompt if it appears.
4. Internal testers (up to 100 on your team) can install immediately. External testers need a short Beta App Review (usually under 24 hours).
5. Play at least a few full sessions from TestFlight on a real device before you submit.

## 7. Submit for review

On the version page, select the build, fill in **App Review Information** (contact details; no login needed), and add a note. Sample note:

> Ribbon is a one-tap arcade game. Tap to flap; the glowing ribbon trailing behind you is your hitbox. Its solid front part kills on contact with an obstacle, while the loose tail only grazes, which builds a score combo. Passing gates grows the ribbon, so the game gets harder as your trail gets longer. The game has a persistent best score, three ribbon color palettes and haptic feedback on crashes. No account or login is required. [Option A: The app has no ads and no in-app purchases.] [Option C: The "Ribbon Styles pack" non-consumable IAP unlocks two extra palettes (Aurora, Ember) from the game-over screen; Restore is next to it.]

Click **Add for Review**, then **Submit**. Review typically takes **24 to 48 hours**. The first submission sometimes takes longer.

## 8. Google Play (brief)

1. **Play Console**: https://play.google.com/console. There is a **$25 one-time** fee, plus identity verification (a few days). **New personal accounts must run a closed test with at least 12 testers for 14 consecutive days** before they can publish to production. Plan for this. Organization accounts are exempt.
2. **Upload key**: `keytool -genkey -v -keystore ribbon-upload.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload`. Keep it out of git (`*.jks` is ignored) and back it up. Enroll in **Play App Signing**, where Google holds the real app signing key.
3. **Build the AAB**: in Android Studio, **Build > Generate Signed App Bundle**, or add a `signingConfigs.release` to `android/app/build.gradle` and run `cd android && ./gradlew bundleRelease`. The output is `android/app/build/outputs/bundle/release/app-release.aab`. Increase `versionCode` in `android/app/build.gradle` for every upload.
4. **Store listing**: 512x512 icon (you can export it from `assets/icon.png`), a 1024x500 feature graphic, and at least 2 phone screenshots.
5. **Data safety form**: with no SDKs, "No data collected or shared". With AdMob, declare Device or other IDs, App interactions, Diagnostics and Approximate location, shared for Advertising. Set up **Ads** to "Contains ads".
6. **Content rating** (IARC questionnaire), **target audience** (do not select under-13 unless you comply with Families policy), and **privacy policy URL**.
7. For IAP, create a managed product `ribbon_styles_pack` under **Monetize > Products** and add the Play app to RevenueCat.
8. Review usually takes a few hours to 3 days. The first review of a new app can take up to 7 days.

## 9. Common rejection reasons for this kind of game

- **4.2 Minimum Functionality**: very simple one-tap games, especially bare Flappy Bird clones, get rejected as not offering enough lasting value. Ribbon's case against this is its distinct mechanic (the growing physics ribbon as your hitbox, with a solid part that kills and a loose tail that grazes for combos) plus a persistent best score, selectable palettes, procedural audio and haptics. **Do not strip those features** to simplify the build. Point them out in the review note.
- **4.3 Spam / copycat**: avoid "Flappy" in the name, keywords or screenshots, and do not use bird art. Use your own icon, which the procedural ribbon icon already is.
- **2.1 App Completeness**: mock ads or mock purchases, placeholder text, crashes, or a blank screen on launch. Test the TestFlight build, not just the debug build.
- **3.1.1 In-App Purchase**: unlocking paid content without Apple IAP, or no Restore button for a non-consumable.
- **5.1.1 / 5.1.2 Privacy**: the privacy label does not match the SDKs you ship, there is no privacy policy URL, or you track users without the ATT prompt.
- **2.3 Accurate Metadata**: screenshots that do not show the actual game, or that mention other platforms or prices.

## 10. Updating later

Edit `index.html`, run `npm run sync`, increase Build (iOS) and `versionCode` (Android), then archive and upload again. If you change the icon, run `npm run icons && npm run assets`.
