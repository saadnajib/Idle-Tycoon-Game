# Merge Forge: Idle Tycoon

A hybrid-casual idle merge game prototype in a single file (`index.html`): vanilla HTML/CSS/JS, Canvas for the grid, gears and particles, and a DOM overlay for the HUD, shop and modals. It loads nothing from the network, so it runs offline and inside a Capacitor webview. The layout is built for portrait phones.

**Gameplay:** gears drop onto a 4x4 grid. Drag two gears of the same level together to merge them into the next level. Every gear earns coins per second, using `cps(level) = round(level² · 1.6^(level-1))`. Drop a gear on the trash zone to sell it for `5 · cps`. Spend coins on Faster Drops, Better Gears, Expand Grid (up to 6x6) and Offline Boost.

## Run

- Open `index.html` directly in a browser, **or**
- serve it: `npx serve .` and open the printed URL (use your phone's browser on the same network to test touch).

The only global is `window.MergeForge` (a debug handle with `state`, `save()`, `load()` and `cellCenter(i)`).

## Monetization mocks

Every ad and in-app purchase goes through the single `Monetization` object in the `<script>` (look for the "Monetization — the SINGLE entry point" comment). Game code never talks to an SDK directly. To go live, keep these method signatures and replace the bodies:

| Method | Mock today | Replace with |
| --- | --- | --- |
| `showRewarded(id, onReward)` | Full-screen "Loading Ad…" overlay (2.5s), then reward | AdMob rewarded video (e.g. `@capacitor-community/admob` `prepareRewardVideoAd` / `showRewardVideoAd`); call `onReward` only from the reward-earned callback |
| `purchase(sku, onSuccess)` | Fake App-Store-style confirm sheet | RevenueCat (`Purchases.purchaseStoreProduct` / `purchasePackage`); call `onSuccess` on a completed transaction, and restore entitlements (`noAds`) on launch |
| `showInterstitial()` | Small banner shown for 3s about every 90s, unless `noAds` | AdMob interstitial |

Reward IDs: `boost_2x`, `free_gear`, `offline_double`. SKUs: `no_ads` ($2.99) and `starter_pack` ($4.99).

## Save data

Progress is saved in `localStorage` under the key **`mergeForge.save.v1`** as JSON. It stores `version`, `coins`, `gems`, `gridSize`, `cells`, `upgrades`, `dropInterval`, `boostUntil`, `noAds`, `lastSeen`, plus `muted`, `pending` and `freeGearAt`.

The game saves 2s after a change, when the page becomes hidden, and on `pagehide`. When you come back, it pays offline earnings for up to 8h at 0.5x–1.75x of live income. The Store tab has a "Reset save" link.

## Capacitor wrap

1. `npm init -y && npm i @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android`
2. Put `index.html` in `www/` (the `dist/` and `www/` build output is gitignored or disposable).
3. `npx cap init "Merge Forge" com.example.mergeforge --web-dir www`, then `npx cap add ios` / `npx cap add android`, then `npx cap sync`.
4. Install the AdMob and RevenueCat Capacitor plugins and wire them into `Monetization`.
5. On native, `localStorage` can be cleared by the OS. For durable saves, consider moving to `@capacitor/preferences`; the `save()`/`load()` functions are the only places that touch storage.
