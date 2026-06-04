# Frontend Image Generation Prompts

Source: `docs/frontend/PAGE_PLAN.md`.

Use this by copying `Global Rules For Every Prompt` plus one page prompt into GPT image generation. Page prompts are still readable alone, but global rules make the set feel like one coherent product.

## Research Notes

Design direction is based on current product UI patterns from:

- Linear-style operator UI: fast sidebar navigation, command/search affordances, dense inbox-style work surfaces. Source: https://linear.app/changelog
- shadcn/ui blocks: composable dashboard/auth/sidebar structures for real app screens. Source: https://ui.shadcn.com/blocks
- Radix Themes: tokenized color scales, accent color for interactive elements, solid/translucent panel backgrounds, focus tokens. Source: https://www.radix-ui.com/themes/docs/theme/color
- Atlassian Design System: 8px spacing base and intentional density. Source: https://atlassian.design/foundations/spacing/
- GitHub Primer: functional color roles instead of random decorative color. Source: https://primer.style/product/primitives/color/

## Global Rules For Every Prompt

- Product: MDC, a professional networking and jobs platform.
- Visual style: premium modern operator console for recruiting and professional networking. Think Linear precision plus shadcn dashboard structure: calm, sharp, dense, editorially spaced, high trust, not generic corporate SaaS.
- Color system: warm off-white canvas, graphite text, slate panels, indigo primary actions, jade success/verified accents, amber warnings, red destructive states. Use color as functional signal, not decoration.
- Layout system: viewport-level left sidebar, compact top command bar, strong active navigation state, split panes for detail workflows, sticky action panels, dense tables where work volume is high, card grids only for discovery pages.
- Surface treatment: mostly flat with hairline borders, very soft shadows only for popovers/modals, 6-8px radius, token-like spacing on an 8px grid, no nested cards.
- Typography: Inter or SF Pro style, crisp hierarchy, compact labels, legible 12-14px data text, 20-28px page titles, no oversized marketing hero type inside app pages.
- Output: 16:9 desktop web app screenshot, no browser chrome, no device frame, no stock-photo hero, no decorative gradient background, no random illustration, no lorem ipsum, no real brand logos.
- Data: realistic fictional people, companies, jobs, messages, notifications, reports, invoices, and analytics.
- Text: make UI text short and legible, but do not rely on perfect spelling for critical value.
- Avoid: LinkedIn clone visuals, all-blue themes, purple gradients, beige startup landing pages, giant rounded cards, heavy drop shadows, empty whitespace, stock-photo people, AI-looking icons, fake glassmorphism, generic template dashboards.

## App Shell

### Global Layout

Create a high-fidelity 16:9 desktop web app screenshot for MDC, a professional networking and jobs platform. Show the authenticated app shell: top navigation with MDC mark, global search input, Feed, Network, Jobs, Messages, Notifications, Companies, plus create post and create job icon buttons. Include left side navigation with active Feed item, unread badges, user menu, active company context switcher, toast area, and a compact error drawer preview with request ID. Use premium modern operator-console styling: warm off-white canvas, slate panels, graphite text, hairline borders, 8px radius, restrained indigo/jade accent, dense readable layout, realistic fictional data, no browser chrome, no decorative background, no lorem ipsum.

### Global Search

Create a high-fidelity 16:9 desktop web app screenshot for MDC showing the global search experience. Show the shell search input expanded into a command-style dropdown with tabs All, People, Companies, Jobs, Posts, keyboard-selected result, recent searches, and a "View all results" row. Include realistic fictional results: people cards with headline, companies with verified badge, jobs with location, posts with snippets. Keep layout dense and professional, warm off-white/slate, hairline borders, 8px radius, indigo/jade accent, no browser chrome, no real brands, no lorem ipsum.

## Public And Auth Pages

### Landing / Public Home

Create a high-fidelity 16:9 desktop web app screenshot for MDC public home. Show a logged-out professional networking homepage as an actual product screen, not a marketing landing page: public feed column with trending posts, job search entry, company search entry, recently published jobs, company discovery cards, sign in and register actions, and gated action prompts on connect/apply/comment buttons. Use restrained premium operator-console styling, realistic fictional professional content, no giant hero illustration, no stock photo, no browser chrome, no lorem ipsum.

### Login

Create a high-fidelity 16:9 desktop web app screenshot for MDC login. Show a focused auth form with email, password, login button, forgot password link, register link, and a subtle "email verification required" banner example near the form. Include right-side compact preview of saved intent, such as "Continue applying to Senior Backend Engineer". Use clean operator-console layout, white card only for the form, subtle border, indigo/jade accent, realistic text, no browser chrome, no decorative gradient, no lorem ipsum.

### Register

Create a high-fidelity 16:9 desktop web app screenshot for MDC registration. Show form fields for email, display name, password, confirm password, terms checkbox, password strength hints, register button, and login link. Include post-submit "check your email" state preview in a small side panel with resend verification action. Use professional operator-console styling, calm warm off-white/slate layout, hairline borders, realistic copy, no stock photos, no browser chrome, no lorem ipsum.

### Email Verification

Create a high-fidelity 16:9 desktop web app screenshot for MDC email verification. Show a token verification page with four visible states in a compact status layout: verifying spinner, success message with continue button, expired token message, invalid token message, and resend verification email form. Keep it clean, centered, accessible, premium operator-console style, warm off-white/slate, restrained indigo/jade accent, no browser chrome, no decorative background, no lorem ipsum.

### Forgot Password

Create a high-fidelity 16:9 desktop web app screenshot for MDC forgot/reset password flow. Show a two-step reset interface: left step request reset by email, right step confirm reset from token URL with new password, confirm password, password rules, and neutral success message that does not reveal whether email exists. Use clean auth page layout, subtle card borders, indigo/jade accent, realistic labels, no browser chrome, no lorem ipsum.

### Logout

Create a high-fidelity 16:9 desktop web app screenshot for MDC route-based logout state. Show a minimal page after sign-out with confirmation that private data is cleared, buttons for Sign in, Register, and Go to public home, plus a small session status checklist. Use calm premium operator-console styling, simple centered layout, warm off-white/slate surfaces, hairline borders, no browser chrome, no decorative illustration, no lorem ipsum.

## Onboarding And Account

### Profile Onboarding

Create a high-fidelity 16:9 desktop web app screenshot for MDC profile onboarding. Show a multi-section profile completion form after first login: headline, location, about, open to work toggle, recruiting eligible toggle, visibility selector, repeatable sections for skills, experience, education, certifications, languages, save draft and submit buttons, and skip link. Include local draft indicator and validation hints. Use dense professional operator-console styling, no browser chrome, no lorem ipsum.

### My Profile

Create a high-fidelity 16:9 desktop web app screenshot for MDC "My Profile". Show public-preview profile with owner controls: avatar, cover area, display name, headline, location, website, about, skills with endorsement counts, experience, education, certifications, languages, posts tab, edit profile button, upload avatar action, and profile completeness sidebar. Use realistic fictional professional data, clean premium operator-console layout, warm off-white/slate, indigo/jade accents, no browser chrome, no lorem ipsum.

### Member Profile Detail

Create a high-fidelity 16:9 desktop web app screenshot for MDC member profile detail for another user. Show authenticated read-only profile with avatar, headline, location, about, skills, endorsements, experience, education, recent posts, and relationship action row: Connect, Follow, Message, Endorse, Block, Report. Include relationship status and mutual connection signal. Use modern professional networking UI, restrained enterprise styling, realistic fictional data, no browser chrome, no real brands, no lorem ipsum.

### Edit Profile

Create a high-fidelity 16:9 desktop web app screenshot for MDC edit profile. Show profile editing form with avatar upload flow, headline, about, location, website, open to work, visibility, and nested list editors for skills, experience, education, certifications, and languages. Include dirty-state guard banner, optimistic preview panel, validation errors, save and cancel buttons. Use clean premium operator-console styling, dense form layout, no browser chrome, no lorem ipsum.

### Account Settings

Create a high-fidelity 16:9 desktop web app screenshot for MDC account settings. Show settings navigation on left and account panel on right with display name, immutable email status, email verified badge, password reset entry point, active session/logout controls, and account update form. Include request ID details in an expandable error row. Use calm premium operator-console styling, warm off-white/slate, hairline borders, no browser chrome, no lorem ipsum.

### Notification Settings

Create a high-fidelity 16:9 desktop web app screenshot for MDC notification settings. Show grouped toggles for new messages, connection requests, connection accepted, application status changes, job recommendations, and post interactions. Include optimistic save state, rollback error toast, and last updated timestamp. Use accessible toggle controls, professional operator-console styling, restrained indigo/jade accent, no browser chrome, no lorem ipsum.

## Feed And Social

### Home Feed

Create a high-fidelity 16:9 desktop web app screenshot for MDC home feed. Show authenticated feed with composer, feed filter/sort, post list, recommendations rail, and notification prompt. Post cards must include author, timestamp, visibility, content, media placeholder, hashtags, mentions, reaction summary, comment count, save/hide/report menu, and optimistic newly posted item at top. Use dense professional networking UI, realistic fictional content, no browser chrome, no lorem ipsum.

### Post Detail

Create a high-fidelity 16:9 desktop web app screenshot for MDC post detail. Show one full post with author, content, media, hashtags, reactions, save/report menu, comments thread with nested replies, reply composer, related author/company actions, and optimistic comment state. Keep replies grouped by parent, with clear timestamps and subtle dividers. Use enterprise social feed styling, warm off-white/slate, indigo/jade accent, no browser chrome, no lorem ipsum.

### Create/Edit Post

Create a high-fidelity 16:9 desktop web app screenshot for MDC create/edit post composer. Show content textarea, visibility selector, media attachment upload area with pending upload progress, mentioned users and hashtags parsing preview, validation message when content is missing, and disabled submit while upload is pending. Include Save draft, Post, and Cancel controls. Use clean modal or full-page composer styling, professional operator-console UI, no browser chrome, no lorem ipsum.

### Hashtag Feed

Create a high-fidelity 16:9 desktop web app screenshot for MDC hashtag feed. Show header for hashtag "#cloudhiring" with summary stats, follow/save action if present, and feed list using same post-card interactions as home feed: reactions, comments, save, hide, report. Include route breadcrumbs from clicked hashtag. Use dense professional social UI, realistic fictional posts, warm off-white/slate, indigo/jade accent, no browser chrome, no lorem ipsum.

### Report Content Modal

Create a high-fidelity 16:9 desktop web app screenshot for MDC report content modal. Show dimmed product page background and centered entity-aware modal for reporting a post/comment/message/profile/company/job. Include target preview, category selector, optional description textarea, rate-limit warning area, submit and cancel buttons, and request ID error area. Use serious moderation-safe SaaS styling, accessible form controls, no browser chrome, no lorem ipsum.

## Network

### Network Dashboard

Create a high-fidelity 16:9 desktop web app screenshot for MDC network dashboard. Show sections for pending requests, accepted connections, suggested people, followers/following summary, and action buttons Accept, Decline, Remove, Follow, Unfollow, Block. Include optimistic accept/decline state with rollback toast. Use professional networking UI, dense cards/table mix, realistic fictional people, hairline borders, indigo/jade accent, no browser chrome, no lorem ipsum.

### People Search

Create a high-fidelity 16:9 desktop web app screenshot for MDC people search. Show search field with 300 ms debounce indicator, filters for location, skills, open to work, result cards with display name, headline, location, mutual signal, and actions Connect, Follow, Message. Include pagination controls and empty state preview in side panel. Use clean professional operator-console styling, no browser chrome, no real brands, no lorem ipsum.

### Connection Requests

Create a high-fidelity 16:9 desktop web app screenshot for MDC connection requests queue. Show incoming and outgoing tabs, batch-friendly request rows with avatar, headline, mutual signal, message snippet, accept/decline buttons, outgoing cancel action, and temporary undo state after local action. Use dense triage layout, warm off-white/slate surfaces, hairline borders, restrained indigo/jade accent, no browser chrome, no lorem ipsum.

### Blocked/Relationship Controls

Create a high-fidelity 16:9 desktop web app screenshot for MDC blocked and relationship controls. Show settings-style list of blocked users, relationship action menu from a profile, confirm destructive social action dialog for blocking/removing, and post-success hidden-from-list state. Use serious but calm SaaS styling, clear warnings, realistic fictional users, no browser chrome, no decorative graphics, no lorem ipsum.

## Jobs And Applicant Workflow

### Job Search

Create a high-fidelity 16:9 desktop web app screenshot for MDC job search. Show keyword search, company filter, employment type, workplace type, location, skill filter, URL-synced filter chips, results list with job title, company, location, workplace, employment, salary, status, save action, cursor pagination, and skeleton loading row. Use dense job marketplace UI, warm off-white/slate, indigo/jade accent, realistic fictional jobs, no browser chrome, no lorem ipsum.

### Job Detail

Create a high-fidelity 16:9 desktop web app screenshot for MDC job detail. Show job title, company card, status, description, employment type, workplace type, location, salary range, skills, apply mode, internal apply button, external apply button with click tracking note, save/unsave, report, and company link. Use professional job detail layout with sticky right action panel, no browser chrome, no real brands, no lorem ipsum.

### Apply To Job

Create a high-fidelity 16:9 desktop web app screenshot for MDC apply-to-job page. Show selected job summary, resume upload/select component with progress, cover letter textarea with autosave indicator, screening questions and answers, duplicate-submit protection, submit application button, and validation messages. Use clean candidate workflow styling, warm off-white/slate surfaces, indigo/jade accent, no browser chrome, no lorem ipsum.

### My Applications

Create a high-fidelity 16:9 desktop web app screenshot for MDC my applications. Show filter bar for status, date, company/job keyword, and cards for submitted applications with job title, company, current status badge, submitted/updated time, next action, and button to open status timeline drawer. Include empty state route to job search. Use dense professional operator-console styling, realistic fictional jobs, no browser chrome, no lorem ipsum.

### Application Detail

Create a high-fidelity 16:9 desktop web app screenshot for MDC application detail with split applicant/employer capability. Show applicant view with submitted content, resume link, cover letter, screening answers, status timeline, withdraw action, and confirmation dialog. Include employer controls in side panel: valid next statuses, notes, and resume URL. Use professional workflow UI, sticky status controls, hairline borders, no browser chrome, no lorem ipsum.

### Saved Jobs

Create a high-fidelity 16:9 desktop web app screenshot for MDC saved jobs. Show saved job list with job cards, company, location, status, saved date, remove action, apply button, and empty state leading to job search. Include optimistic remove state with undo-like local feedback. Use clean job board SaaS styling, warm off-white/slate, restrained indigo/jade accent, realistic fictional data, no browser chrome, no lorem ipsum.

## Companies

### Company Directory

Create a high-fidelity 16:9 desktop web app screenshot for MDC company directory. Show searchable company list with filters, cursor pagination, company cards containing logo placeholder, name, industry, verified badge, headquarters, employee count, follower count, and follow action. Include cached card loading shimmer. Use professional company discovery UI, warm off-white/slate, hairline borders, no real logos, no browser chrome, no lorem ipsum.

### Company Detail

Create a high-fidelity 16:9 desktop web app screenshot for MDC company detail. Show company profile header, logo, cover area, verified state, about section, jobs tab, posts/feed tab, members preview, follow/unfollow action, and role-aware admin controls for edit, manage members, jobs, recruiting, billing, analytics. Use clean professional networking layout, realistic fictional company data, no real brands, no browser chrome, no lorem ipsum.

### Create Company

Create a high-fidelity 16:9 desktop web app screenshot for MDC create company page. Show form fields for name, industry, description, website, employee count, founded year, headquarters, idempotency key/pending-submit indicator, verified-email gate banner, and route-to-setup success preview. Use clean premium operator-console form layout, subtle validation states, indigo/jade accent, no browser chrome, no lorem ipsum.

### Edit Company

Create a high-fidelity 16:9 desktop web app screenshot for MDC edit company. Show role-gated company profile form with logo and cover media upload, name, industry, description, website, employee count, founded year, headquarters, unsaved changes banner, save/cancel buttons, and read-only/forbidden state preview for insufficient role. Use professional admin form styling, no browser chrome, no lorem ipsum.

### Company Members

Create a high-fidelity 16:9 desktop web app screenshot for MDC company members. Show member management table with user, role, title/status, joined date, actions, add member by user ID, invite by email, change role menu, remove member confirmation, and warning against removing last owner. Use dense admin operator-console table styling, realistic fictional people, hairline borders, no browser chrome, no lorem ipsum.

### Company Invitations

Create a high-fidelity 16:9 desktop web app screenshot for MDC company invitation acceptance. Show token-based invitation page with company card, inviter, role, accept button, login-required banner preserving token, and success state routing into company workspace. Use clean premium operator-console styling, warm off-white/slate, indigo/jade accent, realistic fictional company, no browser chrome, no lorem ipsum.

### Recruiter Seats

Create a high-fidelity 16:9 desktop web app screenshot for MDC recruiter seats management. Show allocated seats, available seats, entitlement summary, company member picker, allocate/deallocate actions, seat table with recruiter name/status/date, and disabled action when no seats remain. Use dense company admin UI, hairline borders, clear status badges, no browser chrome, no lorem ipsum.

## Employer Jobs And Applications

### Employer Job Dashboard

Create a high-fidelity 16:9 desktop web app screenshot for MDC employer job dashboard. Show company-scoped job table with tabs Draft, Published, Closed, Deleted, columns title, status, applications, views if available, updated, per-row actions publish/close/delete, and active company selector. Use dense recruiter/admin operator-console styling, realistic fictional jobs, hairline borders, indigo/jade accent, no browser chrome, no lorem ipsum.

### Create/Edit Job

Create a high-fidelity 16:9 desktop web app screenshot for MDC create/edit job page. Show job form fields for title, description, apply mode, apply URL, employment type, workplace type, location, skills, salary min/max/currency, draft save, publish after validation, external URL required warning, and validation side panel. Use professional employer workflow UI, no browser chrome, no lorem ipsum.

### Job Applications

Create a high-fidelity 16:9 desktop web app screenshot for MDC job applications page. Show pipeline view and table view toggle for one job, status lanes, applicant cards, submitted date, resume indicator, notes count, open detail action, status change menu, add note action, and cursor pagination per status tab. Use dense recruiting workflow styling, clear badges, hairline borders, no browser chrome, no lorem ipsum.

### Application Review

Create a high-fidelity 16:9 desktop web app screenshot for MDC employer application review workspace. Show applicant profile summary, cover letter, screening answers, resume download, status history timeline, internal notes list, note composer, sticky status controls, and valid next status buttons. Use professional recruiting review UI, dense split-panel layout, realistic fictional data, no browser chrome, no lorem ipsum.

## Recruiting

### Recruiting Dashboard

Create a high-fidelity 16:9 desktop web app screenshot for MDC recruiting dashboard. Show active company selector, saved candidates summary, talent pools summary, recent candidate activity, empty state pointing to People Search, and quick actions for create pool and search talent. Use enterprise recruiting SaaS styling, warm off-white/slate, hairline borders, restrained indigo/jade accent, realistic fictional data, no browser chrome, no lorem ipsum.

### Saved Candidates

Create a high-fidelity 16:9 desktop web app screenshot for MDC saved candidates. Show table/list with candidate, source, note snippet, saved by, saved date, save/unsave, add to pool, message, add note actions, and per-candidate action menu. Include no bulk action message because backend lacks bulk support. Use dense recruiter operator-console UI, realistic fictional candidates, no browser chrome, no lorem ipsum.

### Talent Pools

Create a high-fidelity 16:9 desktop web app screenshot for MDC talent pools. Show list and selected detail side by side: pool metadata, create/edit/delete actions, candidate list, add/remove candidate controls, delete confirmation, and temporary reversible removal state before request completes. Use professional recruiting database styling, warm off-white/slate, hairline borders, clear status chips, no browser chrome, no lorem ipsum.

### Candidate Profile For Recruiters

Create a high-fidelity 16:9 desktop web app screenshot for MDC candidate profile for recruiters. Show authenticated member profile plus recruiting sidebar with active company permission, save candidate, add to talent pool, start recruiting conversation, recruiter notes preview, and permission-gated disabled state. Use professional talent sourcing UI, realistic fictional candidate, no browser chrome, no lorem ipsum.

## Messaging And Realtime

### Inbox

Create a high-fidelity 16:9 desktop web app screenshot for MDC inbox. Show two-pane messaging layout with conversation list, selected thread, unread badges, cursor-load older messages, optimistic sent message, reconnect banner, typing indicator, read receipts, and unread count sync. Use clean enterprise chat styling, dense, readable, high-trust, no attachment send UI, realistic fictional messages, no browser chrome, no lorem ipsum.

### Conversation Detail

Create a high-fidelity 16:9 desktop web app screenshot for MDC conversation detail. Show header with participants, title, presence indicator, message groups by day and sender, read receipts, text composer, send button, typing events, and subtle note that attachments are unavailable. Use professional messaging UI, warm off-white/slate, indigo/jade accent, no browser chrome, no lorem ipsum.

### New Conversation

Create a high-fidelity 16:9 desktop web app screenshot for MDC new conversation page. Show participant picker limited to one user, search results, selected recipient chip, message starter area if available, create conversation button, and state where backend routes to existing conversation. Use clean operator-console communication UI, realistic fictional people, hairline borders, no browser chrome, no lorem ipsum.

### Recruiting Conversation

Create a high-fidelity 16:9 desktop web app screenshot for MDC recruiting conversation start flow. Show candidate-focused start conversation panel, active company context requirement, candidate card, company selector, permission gate if company context missing, and create recruiting conversation button. Use professional recruiter workflow styling, no browser chrome, no real brands, no lorem ipsum.

## Notifications

### Notification Center

Create a high-fidelity 16:9 desktop web app screenshot for MDC notification center. Show unread/read tabs, notification list, unread count, mark read and mark all read actions, realtime "new notification" prepend state, action URL navigation row, and optimistic read state. Use dense notification management UI, warm off-white/slate, hairline borders, indigo/jade accent, realistic fictional notifications, no browser chrome, no lorem ipsum.

### Notification Popover

Create a high-fidelity 16:9 desktop web app screenshot for MDC notification popover from the top nav bell. Show compact latest unread notifications from cache, mark all read, view all, unread badge, websocket new notification indicator, and fallback disconnected state. Use polished popover styling, fixed width, subtle shadow, accessible focus states, no browser chrome, no lorem ipsum.

## Media Flow

### Media Upload Component

Create a high-fidelity 16:9 desktop web app screenshot for MDC shared media upload component. Show file picker/dropzone, file list, upload progress, validation errors, remove/replace, retry, purpose selector limited to avatar/resume/attachment, and four-step flow labels: initiate, upload to presigned URL, confirm, attach media ID. Use clean reusable component styling, no browser chrome, no lorem ipsum.

### Media Preview/Download

Create a high-fidelity 16:9 desktop web app screenshot for MDC media preview/download. Show media detail panel with lazy fetch state, preview area, download/open button, expired URL retry state, failed media load warning, and metadata like file name, content type, created time. Use restrained premium operator-console styling, hairline borders, realistic fictional file data, no browser chrome, no lorem ipsum.

## Billing

### Plans

Create a high-fidelity 16:9 desktop web app screenshot for MDC billing plans. Show public plan comparison table/cards for company hiring features, monthly/yearly prices, feature lists, plan detail link, choose plan button, and state where anonymous user choosing a plan starts auth/company flow. Use professional operator-console billing UI, clear pricing hierarchy, no decorative gradients, no browser chrome, no lorem ipsum.

### Company Subscription

Create a high-fidelity 16:9 desktop web app screenshot for MDC company subscription page. Show current plan, subscription status, period dates, cancel-at-period-end status, change plan and cancel actions, owner-only action gating, billing admin read-only state, and confirmation dialog for cancel. Use clean admin billing UI, hairline borders, indigo/jade accent, realistic fictional company data, no browser chrome, no lorem ipsum.

### Invoices

Create a high-fidelity 16:9 desktop web app screenshot for MDC invoices page. Show invoice table and selected invoice detail with invoice number, status, amount due/paid, period, due date, paid date, provider URL, line items, and open provider URL action. Use dense billing SaaS table layout, warm off-white/slate, clear status badges, no browser chrome, no lorem ipsum.

### Admin Billing Plans

Create a high-fidelity 16:9 desktop web app screenshot for MDC admin billing plans. Show admin table of plans and side form for create/edit with name, slug, description, features JSON/editor, monthly price, yearly price, public flag, save button, validation errors, and permission-gated admin nav. Use professional admin operator-console UI, dense table/form split, no browser chrome, no lorem ipsum.

## Search And Recommendations

### Search Results

Create a high-fidelity 16:9 desktop web app screenshot for MDC full search results. Show URL query, tabs All, People, Companies, Jobs, Posts, result groups with type-specific cards, filter sidebar, cache/stale indicator, and separate empty state per result type. Include realistic fictional people, companies, jobs, and posts. Use dense search SaaS layout, warm off-white/slate, indigo/jade accent, no browser chrome, no lorem ipsum.

### Recommendations

Create a high-fidelity 16:9 desktop web app screenshot for MDC recommendations page. Show dashboard modules for people, jobs, and companies recommendations, each with dismiss/save/connect/apply/follow actions that update locally. Include explanation-free UI with clear cards, pagination, and empty state after dismissals. Use professional networking SaaS styling, realistic fictional content, no browser chrome, no real brands, no lorem ipsum.

## Moderation

### Moderation Queue

Create a high-fidelity 16:9 desktop web app screenshot for MDC moderation queue. Show tabs by report status, report table with target type, category, priority, reporter, assigned moderator, created time, status, claim action, view target action, and apply action button. Use serious moderation console styling, dense data table, clear severity badges, no browser chrome, no decorative graphics, no lorem ipsum.

### Report Detail / Action Panel

Create a high-fidelity 16:9 desktop web app screenshot for MDC report detail and action panel. Show report metadata, target preview, history/actions timeline, claim state, moderation action form with action type, target entity, target ID, reason, duration hours, destructive confirmation, and request ID error details. Use professional trust-and-safety admin UI, no browser chrome, no lorem ipsum.

## Admin

### Admin Dashboard

Create a high-fidelity 16:9 desktop web app screenshot for MDC admin dashboard. Show permission-gated cards linking to users, companies, jobs, moderation, analytics, outbox, and reindex tools. Include compact counters, recent system activity, admin nav, and forbidden hidden-card state for missing permissions. Use restrained enterprise admin styling, warm off-white/slate, hairline borders, no browser chrome, no lorem ipsum.

### User Management

Create a high-fidelity 16:9 desktop web app screenshot for MDC admin user management. Show user table with status/search filters, email, display name, status, created date, status action menu, reason field modal, and permission badge. Use dense admin data table styling, clear status chips, request ID error reveal, realistic fictional users, no browser chrome, no lorem ipsum.

### Company Management

Create a high-fidelity 16:9 desktop web app screenshot for MDC admin company management. Show searchable company table with verified status, industry, created date, verification controls, notes field for verification action, and permission-gated actions. Use dense enterprise admin UI, hairline borders, clear badges, realistic fictional companies, no browser chrome, no real logos, no lorem ipsum.

### Job Management

Create a high-fidelity 16:9 desktop web app screenshot for MDC admin job management. Show table filtered by company ID and cursor, columns title, company ID, status, created date, updated date, and link to job detail. Include filter drawer and empty/loading/error states preview. Use professional admin operator-console table styling, no browser chrome, no lorem ipsum.

### Dead Letter Outbox

Create a high-fidelity 16:9 desktop web app screenshot for MDC dead letter outbox. Show failed outbox event queue with event type, payload preview, failure reason, failed date, replay action, replay confirmation modal, and post-replay refresh status. Use technical admin console styling, dense table, monospace payload snippets, clear risk warning, no browser chrome, no lorem ipsum.

### Search Reindex

Create a high-fidelity 16:9 desktop web app screenshot for MDC search reindex admin tool. Show entity type selector, run reindex button, disabled pending state, accepted state, recent run placeholder, and permission-gated admin nav. Include concise warning that reindex is operational action. Use clean technical admin UI, hairline borders, indigo/jade accent, no browser chrome, no lorem ipsum.

## Analytics

### Analytics Dashboard

Create a high-fidelity 16:9 desktop web app screenshot for MDC analytics dashboard. Show admin-only overview with core counters, daily trends chart, top entities table, recent events if returned, date range controls disabled unless supported, and permission-gated nav. Use professional analytics SaaS styling, clean charts, dense data cards, restrained colors, no browser chrome, no decorative gradients, no lorem ipsum.

### Entity Analytics

Create a high-fidelity 16:9 desktop web app screenshot for MDC entity analytics. Show route by entity type and ID, metrics for views, impressions, clicks, event list, entity summary card, and permission-aware access for company admins, job managers, and platform admins. Use clean analytics detail layout, warm off-white/slate, subtle charts, realistic fictional event data, no browser chrome, no lorem ipsum.

### Analytics Event Tracking

Create a high-fidelity 16:9 desktop web app screenshot for MDC analytics event tracking admin/debug view. Show explicit product events such as profile view, company view, job view, apply click, post impression, search result click, throttle/debounce status, event payload preview, and submit status to `POST /analytics/events`. Use technical SaaS diagnostics styling, dense table/log layout, no browser chrome, no lorem ipsum.

## Error, Empty, And Access Pages

### Not Found

Create a high-fidelity 16:9 desktop web app screenshot for MDC not found page. Show unknown route or missing resource message, actions Go home, Search, Back, and a compact suggested routes panel for Feed, Jobs, Companies, Profile. Use clean premium operator-console error-state styling, no illustration-heavy layout, warm off-white/slate, hairline borders, no browser chrome, no lorem ipsum.

### Unauthorized

Create a high-fidelity 16:9 desktop web app screenshot for MDC unauthorized page. Show missing/expired session message after refresh failure, actions Login and Register, preserved intended destination preview, and security note that private cached data was cleared. Use clean access-state UI, warm off-white/slate, indigo/jade accent, no browser chrome, no decorative gradient, no lorem ipsum.

### Forbidden

Create a high-fidelity 16:9 desktop web app screenshot for MDC forbidden access page. Show missing company role/admin permission/email verification state, required access details, active account/company switcher, request ID details, and actions request access, switch company, go back. Use serious premium operator-console access-control styling, clear permission badges, no browser chrome, no lorem ipsum.

### Rate Limited

Create a high-fidelity 16:9 desktop web app screenshot for MDC rate limited page. Show generic 429 response state with retry-after timer when provided, disabled mutation retry, explanatory copy, request ID details, and safe navigation actions. Use calm operational error UI, warm off-white/slate, hairline borders, no decorative art, no browser chrome, no lorem ipsum.

### Offline / Reconnecting

Create a high-fidelity 16:9 desktop web app screenshot for MDC offline/reconnecting state. Show shell-level websocket/API connectivity banner, reconnecting indicator, draft preservation for posts/messages/forms, disabled unsafe mutations, and realtime-heavy page example with stale messages and local draft. Use professional operator-console resilience UI, clear status badges, no browser chrome, no lorem ipsum.
