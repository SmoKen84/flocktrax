# FlockTrax Play Submission Pack

Date: 2026-05-06
Timezone: America/Chicago
App: `FlockTrax`
Android package: `com.flocktrax.mobile`
App version: `1.0.1`

## 1. Store Listing Draft

### App name

`FlockTrax`

### Short description

`Barn data collection for flock placements, mortality, weights, and feed.`

This is within the Play short-description limit and matches the current feature set.

### Full description

`FlockTrax helps poultry field teams capture barn and flock information from the field with a focused mobile workflow.

Use FlockTrax to:

- sign in with your assigned FlockTrax account
- review active flock placements by farm and barn
- record daily flock management details
- enter mortality and cull counts
- capture weight summaries
- manage feed ticket and feed drop information
- review placement status and weather context for farm locations

FlockTrax is designed for operational use by authorized farm, field, and management personnel. Access is account-based, and available actions depend on the permissions assigned to your user profile.

Key features:

- active placements dashboard
- farm-group and farm filtering
- daily log entry
- mortality entry
- weight entry
- feed ticket workflow
- in-app account deletion flow

FlockTrax is intended for business and agricultural operations, not for general consumer social use.`

## 2. Core Console Fields

### App category

Recommended: `Business`

Reason:
- the app is an authenticated operational data-collection tool
- it is not a game, media app, or consumer lifestyle product

### Tags

Recommended options if helpful:

- `agriculture`
- `operations`
- `business`
- `field data`

### Contact details

Use the business contact email you want shown publicly in Play Console.

Do not use the reviewer login email as the public contact address unless that is intentional.

### Ads

Recommended answer: `No, this app does not contain ads.`

Basis:
- no ad SDKs found in `C:\dev\FlockTrax\mobile\package.json`
- no ad flow found in the mobile code audit

## 3. App Access / Reviewer Notes Draft

Because the app requires login, provide complete reviewer access instructions in Play Console.

### Reviewer instructions draft

`FlockTrax requires a login to access app content. Please sign in using the review account below.

Review account email:
reviewme@mothercluckershenhouse.com

Review account password:
FlockTraxReview!2026

Review steps:
1. Sign in on the login screen.
2. Open the Active Flocks dashboard.
3. Open a placement to review daily log and mortality entry screens.
4. Open Feed Ticket to review feed ticket functionality.
5. To review account deletion, return to the dashboard and tap Delete Account.

Important note:
If you need a disposable account for deletion testing, use a separate throwaway account rather than deleting the main reviewer account.`

### Internal note

From the current release checkpoint, the known throwaway/demo account used for deletion testing is:

- `flocktraxuser@gmail.com`
- `FlockTrax26!`

Do not place the throwaway account in the public store listing. Use it only in restricted reviewer notes if needed.

## 4. Data Safety Draft

This section is a first-pass draft based on the current repo behavior and should be confirmed in Play Console before final submission.

### High-level answers

- Does the app collect or share any of the required user data types?
  - Recommended: `Yes`
- Is all user data collected by this app encrypted in transit?
  - Recommended: `Yes`
- Do you provide a way for users to request that their data is deleted?
  - Recommended: `Yes`
- Does the app share data with third parties?
  - Recommended: `No`, based on the current audit

### Data types likely collected

#### Personal info > Email address

Recommended declaration:

- collected: `Yes`
- shared: `No`
- purpose:
  - `App functionality`
  - `Account management`
- processed ephemerally: `No`
- user can choose whether this data is collected: `No`

Basis:
- login
- password reset
- user profile fetch

#### Personal info > User IDs

Recommended declaration:

- collected: `Yes`
- shared: `No`
- purpose:
  - `App functionality`
  - `Account management`
- processed ephemerally: `No`
- user can choose whether this data is collected: `No`

Basis:
- authenticated user session and profile
- access control by assigned permissions

#### Personal info > Other info or User-generated content

Recommended review decision:

- likely collected: `Yes`
- shared: `No`
- purpose:
  - `App functionality`

Why this likely applies:
- freeform notes and comments exist in the app data model:
  - placement comments
  - cull notes
  - dead reason
  - feed notes
  - weight other note

Play Console category choice to verify:
- this may fit better under `Other user-generated content` than under `Personal info > Other info`

### Data types likely not collected

Recommended: `No`, unless the app changes before submission

- precise location
- approximate location
- personal name
- phone number
- address
- contacts
- photos and videos
- audio files
- files and docs
- calendar
- app activity for analytics
- browsing history
- device or other IDs for advertising/analytics
- financial info
- health or fitness
- messages

### Important Data Safety nuance

The app sends farm latitude/longitude to Open-Meteo for weather lookup, but this appears to be business facility location data loaded from the backend, not device GPS collected from the user’s phone.

Recommended current declaration:

- do **not** declare device `Location` unless the Android app begins requesting device location permission or transmitting the user/device physical location

## 5. Account Deletion / Privacy Notes

Current mobile behavior supports:

- in-app `Delete Account` entry point on the dashboard
- typed confirmation: `DELETE`
- account deletion request via backend function
- session cleared after deletion

This supports Play's account deletion expectation for apps with account creation/login.

Still needed for submission:

- a public privacy policy URL
- possibly a public web deletion-support URL if requested during Play review or Data safety/account-deletion setup

## 6. Content Rating / Audience Draft

### Target audience

Recommended:

- adults
- business / agricultural operations users

### Child-directed

Recommended: `No`

### Likely rating outcome

Recommended expectation: `Everyone`

This is only an expectation. Final rating depends on the official questionnaire.

## 7. Asset Inventory

### Existing candidate screenshots

These files appear usable as source material for Play screenshots:

- `C:\dev\FlockTrax\mobile\ReleaseSupport\AppScreens\Dashboard.jpg`
- `C:\dev\FlockTrax\mobile\ReleaseSupport\AppScreens\FeedDelivery.jpg`
- `C:\dev\FlockTrax\mobile\ReleaseSupport\AppScreens\Mortality.jpg`
- `C:\dev\FlockTrax\mobile\ReleaseSupport\AppScreens\ReminderTasks.jpg`
- `C:\dev\FlockTrax\mobile\ReleaseSupport\AppScreens\WeatherPopup.jpg`
- `C:\dev\FlockTrax\mobile\screens\13.0.canvas\Login.png`
- `C:\dev\FlockTrax\mobile\screens\13.0.canvas\dashboard.png`
- `C:\dev\FlockTrax\mobile\screens\13.0.canvas\FeedTicket.png`
- `C:\dev\FlockTrax\mobile\screens\13.0.canvas\FeedTicketList.png`
- `C:\dev\FlockTrax\mobile\screens\13.0.canvas\Weights.png`

### Existing icon assets

- `C:\dev\FlockTrax\output\MC_Favicon2-transparent.png`
- `C:\dev\FlockTrax\output\MC_Favicon2-favicon-master.png`
- `C:\dev\FlockTrax\output\MC_Favicon2-preview.png`

### Still missing or not yet confirmed

- Play feature graphic
- finalized phone screenshots cropped to Play requirements
- finalized public privacy policy URL

## 8. Release Execution Steps

### First Android production build

From `C:\dev\FlockTrax\mobile`:

```powershell
npx eas-cli@latest login
npx eas-cli@latest build --platform android --profile production
```

Recommended prompt choices:

- keep remote app version source
- let EAS manage Android credentials/keystore if no existing keystore policy says otherwise

### First Play upload

Use the first generated `.aab` for a manual Play Console upload.

Reason:
- Expo documents that the first Google Play submission must be manual before `eas submit` automation can be used

### After first manual upload

Optional later improvement:

- add Android submit profile to `C:\dev\FlockTrax\mobile\eas.json`
- configure Play service account for future `eas submit`

## 9. Final Pre-Submission Checklist

- confirm Play developer account type
- confirm whether closed-test gating applies
- publish privacy policy URL
- prepare final screenshots and feature graphic
- confirm reviewer account still works
- build Android production `.aab`
- upload first `.aab` manually
- complete App content
- complete Data safety
- complete content rating
- complete App access
- start closed test or production rollout, depending on account status

