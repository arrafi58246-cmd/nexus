# Profile sharing and Discovery follow-up — 10 October 2026

Scope: UI-05 / U04 and the existing authenticated part of UI-21 / U16.

## Result

- Student Profile displays its existing `/profile/{userId}` link, using the browser's current origin. The receiving user still needs an ACTIVE NEXUS account and login.
- Clipboard success is shown only after writeText resolves. Pending disables the button; failure or unsupported clipboard offers selection and manual copying.
- Discovery adds a GET name search that combines with existing filters and reset. Matching is literal and case insensitive, including wildcard characters.
- Cards add participant scope, Verified Participant XP from xp_rules, an embedded count of only OPEN_RECRUITMENT squads, and a detail link. Missions with no open squads remain visible. Embedded aggregation avoids counting only the first API page of squad rows.
- Registration-expired missions remain excluded. Missing XP rule/count and query errors do not become invented zero rewards or sample data.

## Validation

- npm run lint: PASS.
- npm run build: PASS (Next.js 16.3.4 / TypeScript).
- Isolated DOM integration with the actual ShareProfile component: PASS for runtime origin, input selection, delayed clipboard success/pending state, denied clipboard and missing Clipboard API.
- Browser download was unavailable in this environment. The DOM test is not a logged-in browser test.
- Authenticated database read policies and actual columns/enums/xp_rules were inspected. Full PostgREST-to-browser Discovery and logged-in recipient profile flow remain NOT VERIFIED.

## Remaining decisions

Anonymous/public access, domain/slug changes remain UI-G08. This change neither opens those permissions nor claims a public domain is deployed.
Search inherits Discovery's existing API list limit; pagination for a large catalog is a separate follow-up.
