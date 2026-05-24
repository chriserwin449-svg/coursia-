# Task 6 — Full-stack Developer Work Record

## Changes Made

### 1. `src/lib/store.ts`
- Added `journeyNotification: boolean` and `setJourneyNotification: (v: boolean) => void` to `AppState` interface
- Initialized `journeyNotification: true` and `setJourneyNotification` setter in the store create

### 2. `src/components/coursia/Journey.tsx`
- In the "Next Badge" card section, added a conditional message when `stats?.completedCourses === 0`:
  - FR: *"Commence ton premier cours pour gagner ton premier badge !"*
  - EN: *"Start your first course to earn your first badge!"*
- Styled with `text-sm text-muted-foreground mt-3 italic`
- Only shows inside the `badgeState?.next` truthy branch (first badge exists but 0 courses done)

### 3. `src/components/coursia/Sidebar.tsx`
- Subscribed to `journeyNotification` from store
- Added `relative` class to the nav item button for absolute positioning
- Added a blinking red notification dot (`w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse`) positioned at `top-2 right-2`
- Dot only renders when `item.view === "journey" && journeyNotification` is true

### 4. `src/components/coursia/AppShell.tsx`
- Subscribed to `setJourneyNotification` from store
- Added a `useEffect` that sets `journeyNotification` to `false` when `view === "journey"`

## Lint & Dev
- Lint: All 6 errors are pre-existing in `mini-services/` (require imports), no new errors introduced
- Dev server: Running cleanly, no compilation errors
