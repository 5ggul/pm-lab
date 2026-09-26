# Google-only login — 2026-09-22

Current user decision: remove legacy email login from the app; defer administrator work.
This document supersedes the earlier temporary email/password fallback instructions in GOOGLE-AUTH-SETUP.md, LAUNCH-CHECKLIST.md, RELEASE-CANDIDATE.md and QA-REPORT.md.

## App changes

- Only Google login is displayed. No email/password form, server action or password-grant helper remains.
- Google CTA uses ordinary full-page navigation; do not replace it with a prefetched Next.js Link.
- The current Google G asset is loaded from the official branding documentation, without recoloring, with an empty decorative alt and no referrer.
- Terms/privacy/community rules are linked beside sign-in; game browsing remains possible without login.
- OAuth cancellation/error and profile-validation errors retain a normalized same-origin return destination.
- Existing users, identities, roles, profile records and stored community content are preserved by the Google-only login change.
- No administrator promotion or transfer is performed. Existing release gates remain locked.

## Hosted Auth boundary — still needs provider configuration

Current hosted Auth verification: Google=true and Email=false.
The app exposes Google-only login and the hosted Email provider is disabled.
Do not re-enable email/password fallback to satisfy older documents or tests.

The old requirement that legacy email login must keep working is withdrawn. Do not reintroduce a fallback to satisfy old documentation or tests. Age self-attestation is also retired and is not part of login or community-write access.
R1_GOOGLE_ONLY_SIGNUP_HOOK_CONFIRM, R1_GOOGLE_E2E_CONFIRM and R1_COMMUNITY_E2E_CONFIRM must not be set from this code change alone.

## Further product work to prioritize

1. Recover drafts and typed values across login, validation errors and back navigation; protect users from double submissions.
2. Review the existing game-follow/update-notification path as a real returning-user journey, not just DB trigger tests.
3. Make unanswered questions and game-specific first-post prompts discoverable without inventing activity.
4. Validate iPhone Safari/WebKit, mobile keyboard behavior and long forms; current broad browser QA is Chromium.
5. Add owner-controlled account deletion and documented content-retention behavior before public launch.

## References

- https://developers.google.com/identity/branding-guidelines
- https://developers.google.com/static/identity/images/g-logo.png
- https://supabase.com/docs/reference/api/v1-update-auth-service-config

No production merge, domain connection, indexing release or AdSense insertion is authorized by this change.
