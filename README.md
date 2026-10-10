# Servon Manager (mobile app for office staff)

Expo SDK 57 / Expo Router app for **admins, coordinators and accountants**. It talks to the same Laravel API as the web app and the technician app (`service-crm-backend`, `/api/v1`), with a Sanctum token from `POST /auth/token` (`app: "manager"`).

Servon Manager is a **plan add-on**: a company can use it only when its subscription plan has the `manager_app` feature (Super admin → Plans → Manager App). If the plan loses it, open sessions are signed out with a message. Technicians are sent to the Servon Technician app.

## What it does

| Tab | Features |
| --- | --- |
| **Home** | Needs-attention list (overdue, unassigned, approvals waiting, low stock), job status tiles, last 14 days logged vs completed, collections this month by method, outstanding and credit, technician leaderboard |
| **Jobs** | Active / Today / Overdue / Unassigned / by status, search, filter by technician, infinite scroll, **New job** button |
| **Job** | Customer call / WhatsApp / map, ask the customer to share their location, complaint and product, **assign / reassign / auto-assign**, **reschedule**, **cancel**, **follow-up call**, visits with parts, **photos** (full screen), **voice notes** (play), **signature**, invoice, feedback, history |
| **New job** | Find a customer (or add one), product, complaint type and summary, priority, visit time (quick chips or date + time picker), service location from PIN code, technician or auto-assign |
| **Approvals** | **Expense claims** with the receipt photo (approve – choose how own-money claims were paid back – or reject with a reason), **leave** requests, **cash close** verification and deposits. Each role sees only the queues it can act on; the tab shows how many are waiting |
| **Money** | Invoices due / all / paid / on credit / walk-in with totals, search; invoice detail with **record payment**, share pay link, send reminder, PDF |
| **More** | Customers (search, history, start a job), stock (low stock), team today (attendance, on duty, last punch location, call), notifications, push test, sign out |

What a role sees follows the same abilities as the API (`abilities` in the profile): e.g. an accountant has no Assign button and no leave queue; a coordinator has no cash or expense approvals.

### Push notifications to office staff

- New service request raised by a customer on the portal (admin, coordinator)
- Cash close submitted by a technician, with the shortfall if any (admin, accountant)
- Expense claim submitted (admin, accountant)
- Leave request (admin, coordinator)
- Low stock (admin, accountant)
- 9:30 am summary of overdue and unassigned jobs (admin, coordinator) – needs the scheduler (`php artisan schedule:run` every minute from cron)

Tapping a notification opens the job, cash close or approval queue it is about.

## Run it in development

```bash
npm install
cp .env.example .env.local    # EXPO_PUBLIC_API_URL = your computer's LAN IP
npx expo start
```

Demo login (after the backend's `DemoSeeder`, with `manager_app` switched on for the demo plan): `admin@demo.test` / `Demo@12345`.

## Push (Firebase)

Servon Manager has its own Firebase project (`test-9a9ed`, Android app `com.servon.manager`). Put its **google-services.json** in this folder (gitignored) and rebuild. On the API server, upload that project's service-account key and set `FCM_MANAGER_CREDENTIALS=/path/to/fcm-manager.json` (the backend records which app registered each phone and sends Manager notifications with that key; without it, it falls back to the technician key `FCM_CREDENTIALS`, which only works if both apps share one project). Without google-services.json the app works; push just isn't available.

## Checks

```bash
npm run typecheck
npx expo export --platform android   # bundles the JS, catches Metro errors
```

## Build the APK on this PC

Same tools and steps as the technician app (see its README): JDK 17 `D:\tools\jdk17`, Android SDK `D:\tools\android-sdk`, local Gradle zip, `subst S: D:\service-crm` for Windows' path limit, release keystore `credentials/servon-release.jks` with passwords from `%USERPROFILE%\.gradle\gradle.properties`.

```bash
export JAVA_HOME=/d/tools/jdk17 ANDROID_HOME=D:/tools/android-sdk NODE_ENV=production
export EXPO_PUBLIC_API_URL=https://service-crm.peoplenex.online
npx expo prebuild --platform android --clean
echo "sdk.dir=D:/tools/android-sdk" > android/local.properties
# android/gradle/wrapper/gradle-wrapper.properties → distributionUrl=file\:///D\:/tools/gradle-9.3.1-bin.zip
subst S: 'D:\service-crm'
cd /s/service-crm-manager/android && ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a,armeabi-v7a
```

## Versioning

`1.0.0` (versionCode 1). The API can ask for an update by returning `min_manager_version` from `GET /api/v1/version`. Bump `version` and `versionCode` for every release.

## Layout

```
src/app/            screens (Expo Router)
  (app)/(tabs)/     Home, Jobs, Approvals, Money, More
  (app)/job/        job detail, new job
  (app)/invoice/    invoice detail
  (app)/cash/       cash close detail (verify, deposit)
  (app)/customers, customer/[id], stock, team, notifications
src/components/     UI kit (shared with the technician app), pickers, photo viewer, voice note player, job card
src/lib/            API client, auth (plan-aware), push, approvals counts, formatting, types
```

Shared code (`components/ui.tsx`, `Text.tsx`, `theme.ts`, `toast.tsx`, `lib/api.ts`, `format.ts`, `push.ts`, `queryCache.ts`) is copied from `service-crm-mobile`; fix bugs in both.
