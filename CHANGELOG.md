# Changelog

All notable changes to this project will be documented in this file.

## [2026-02-13]

### Added
- Created shared `HaasEvent` / `RawHaasEvent` types in `src/types/event.ts` and data helpers (`getAllEvents`, `getEventByUid`) in `src/lib/events.ts`.
- Built `HaasEventDetail` page (`src/pages/HaasEventDetail.tsx`) — loads Haas events from local JSON, displays event details, lists ride groups grouped by time window, and supports ride creation.
- Added `/haas-events/:eventUid` route in `App.tsx` for the new page.
- On first ride creation for a Haas event, a minimal Supabase "shadow" event record is auto-created so ride groups maintain FK integrity.
- Integrated Nominatim geocoding into `src/lib/event-importer.ts` to calculate and store event latitudes, longitudes, and distances from Haas.
- Added a "Connect Google Calendar" button and `handleGoogleConnect` function to `Events.tsx` to initiate the OAuth flow.

### Changed
- Updated `EventCard.tsx` to navigate to `/haas-events/:uid` instead of `/events/:uid`.

### Changed
- Updated logic in `src/lib/event-importer.ts` to set event locations containing "sign in to download location" to "Location Unknown".
- Updated `Events.tsx` to fetch events from the local `haas-events.json` file instead of Supabase.
- Updated `EventCard.tsx` to handle "Location Unknown" display for events and changed the card's `onClick` behavior to navigate to an internal event detail page (`/events/:eventId`).
- Replaced the web scraper with a more reliable ICS event importer. The new script is located at `src/lib/event-importer.ts`.

## [2026-02-12]

### Added
- Created the initial Product Requirements Document (PRD) for the "Berkeley Rideshare Hub 2.0" pivot. The PRD is located in `PRODUCT_REQUIREMENTS.md`.
- Created this `CHANGELOG.md` to track changes to the codebase.
