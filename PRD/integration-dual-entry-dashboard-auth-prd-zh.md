# 双入口分离、认证门禁与管理端数据大屏整合 PRD

状态：ready-for-agent

## Problem Statement

当前项目已经形成多个协作分支：主线版本包含游客端路线导航、地图、游览中与回顾等体验能力；同事版本补齐了游客端与管理端双入口分离、游客/管理员认证、管理端权限保护，以及运营数据大屏与游客感受度分析能力。

现在需要把同事版本的后台优化成果整合回当前版本，同时避免覆盖当前版本已经完成的游客端路线导航能力。整合后的系统需要保持演示稳定：游客端与管理端入口清晰分离，游客端不再暴露管理端入口，管理端必须通过独立端口和登录态访问，数据看板能够展示运营概览、游客关注点、服务建议、热门问答聚类和 LLM 增强状态。

## Solution

以当前版本为整合基础，保留现有游客端内部功能和路线导航链路，在此基础上完整并入同事版本的双端口分离、认证门禁、管理端强鉴权、数据大屏后端分析能力和配套启动验证体系。

整合完成后，游客端固定从 `http://127.0.0.1:5173/` 访问，管理端固定从 `http://127.0.0.1:5174/` 访问。游客端不会展示任何切换到管理端的入口，访问游客端上的 `/admin` 或 `/admin/*` 不应展示后台内容。管理端在 `5174` 下使用根路径体系，例如 `/login`、`/dashboard`、`/spots`、`/routes`、`/knowledge`、`/logs`。

游客端保留首页公开访问。未登录游客只能访问首页；景点、路线、AI 导游、路线草稿、游览中、游览回顾等游客业务页面都需要前端门禁。游客业务接口保持当前访问方式，不额外收口为后端强鉴权。管理端登录、管理端 API、后台页面访问必须由管理员 token 保护。

数据大屏落在现有 dashboard，不新增独立页面。后端完整并入运营概览与游客感受度报告能力，包含规则分析、MiMo 兼容 LLM 增强、热门问答聚类、失败降级和安全错误展示。非 dashboard 的后台业务页只做双入口和鉴权接入所需的最小改动。

## User Stories

1. As a visitor, I want to enter the visitor site from `5173`, so that I am not exposed to admin-only routes or controls.
2. As a visitor, I want the homepage to remain publicly accessible, so that I can understand the Ling Shan scenic AI guide before logging in.
3. As a visitor, I want clear login and registration actions on the homepage, so that I can unlock the guide features without guessing where to start.
4. As a visitor, I want the homepage typography and UI style to match the teammate version, so that the public entry feels consistent with the new authentication flow.
5. As a visitor, I want the visitor navigation to show only public navigation before login, so that inaccessible links do not create confusing dead ends.
6. As a visitor, I want the full visitor navigation to appear after login, so that I can access spots, routes, AI guide, and route navigation features.
7. As a visitor, I want `/spots` to require login, so that scenic browsing follows the same gated visitor experience.
8. As a visitor, I want spot detail pages to require login, so that direct deep links cannot bypass the visitor gate.
9. As a visitor, I want `/routes` to require login, so that route recommendation is unlocked only after authentication.
10. As a visitor, I want `/guide` to require login, so that AI guide chat follows the same visitor session model.
11. As a visitor, I want route draft pages to require login, so that route planning cannot be accessed anonymously through direct URLs.
12. As a visitor, I want tour-in-progress pages to require login, so that active route navigation stays inside the authenticated visitor experience.
13. As a visitor, I want tour recap pages to require login, so that completed route summaries are not anonymously reachable.
14. As a visitor, I want protected visitor pages to redirect safely back to the homepage when I am not logged in, so that I do not see blank or broken screens.
15. As a visitor, I want login and registration pages to preserve the visual language of the public visitor shell, so that authentication feels like part of the same product.
16. As a visitor, I want the existing route navigation, map, tour, and recap capabilities to keep working after integration, so that current visitor-side progress is not lost.
17. As a visitor, I want the visitor site to remove any management or OPS entry from the header, so that the visitor experience remains focused on guide usage.
18. As an administrator, I want to access the admin system only from `5174`, so that operational tools are clearly separated from the visitor site.
19. As an administrator, I want a dedicated admin login page, so that administrator authentication is explicit and separate from visitor login.
20. As an administrator, I want admin routes such as `/dashboard`, `/spots`, `/routes`, `/knowledge`, and `/logs` to live at the root of the admin app, so that the management URL structure is clean.
21. As an administrator, I want old admin paths under `/admin/*` on the admin port to redirect compatibly, so that existing bookmarks do not fail abruptly.
22. As an administrator, I want admin pages to redirect to login when my token is missing or invalid, so that expired sessions fail safely.
23. As an administrator, I want admin API calls to include my admin token, so that backend permissions protect operational data.
24. As an administrator, I want visitor accounts to be rejected from admin login, so that visitor credentials cannot access management features.
25. As an administrator, I want the dashboard to keep existing operational cards and logs, so that previously available management context remains visible.
26. As an administrator, I want the dashboard to show today, week, current range service sessions, question volume, and satisfaction score, so that I can quickly understand visitor service load.
27. As an administrator, I want to switch dashboard time ranges between today, this week, recent 7 days, and recent 30 days, so that I can compare short-term and broader operation windows.
28. As an administrator, I want sentiment trend data on the dashboard, so that positive, neutral, and negative visitor interactions are visible over time.
29. As an administrator, I want satisfaction trend data to show null when there are no samples, so that empty data is not misrepresented as zero satisfaction.
30. As an administrator, I want visitor concern topics grouped by operational categories, so that I can understand what visitors are asking about most.
31. As an administrator, I want representative original visitor questions under each concern topic, so that the dashboard preserves real visitor wording.
32. As an administrator, I want service suggestions derived from high-frequency and negative topics, so that the dashboard points toward concrete operational improvements.
33. As an administrator, I want popular questions clustered semantically when LLM is available, so that similar questions are not scattered across the dashboard.
34. As an administrator, I want the system to fall back to local rule clustering when LLM is unavailable, so that the dashboard remains useful in demo mode.
35. As an administrator, I want the dashboard to show whether the report is LLM-enhanced, rule-based, or rule fallback, so that I understand the confidence and generation mode.
36. As an administrator, I want LLM errors to be safe status codes rather than raw provider errors, so that secrets and stack traces are not exposed.
37. As an administrator, I want empty data states to render clearly, so that the dashboard remains stable before real chat logs exist.
38. As a backend maintainer, I want operations analytics to be implemented as a testable service module, so that rules and fallback behavior can be verified independently.
39. As a backend maintainer, I want authentication token creation and validation to be centralized, so that visitor and admin login behavior stays consistent.
40. As a backend maintainer, I want default administrator initialization to happen during startup or bootstrap, so that local demo setup remains simple.
41. As a frontend maintainer, I want separate visitor and admin app entrypoints, so that route trees and authentication behavior do not leak across products.
42. As a frontend maintainer, I want the current visitor route navigation pages to remain owned by the current version, so that teammate integration does not regress map and tour work.
43. As a frontend maintainer, I want dashboard API clients to call all required admin dashboard endpoints with the admin token, so that UI data loading matches backend permissions.
44. As a frontend maintainer, I want mock dashboard data to include operational overview and visitor insights states, so that admin verification can run without real MiMo access.
45. As a developer, I want one frontend dev command to launch both visitor and admin entries, so that local development remains convenient.
46. As a developer, I want single-entry dev commands for visitor and admin, so that I can debug either side independently.
47. As a developer, I want Windows startup scripts to launch backend, visitor frontend, and admin frontend on agreed ports, so that demos start reliably.
48. As a developer, I want verification scripts for visitor auth, admin login, admin API auth, and dual entrypoints, so that regressions are caught before demo.
49. As a project maintainer, I want docs to reference `5174` as the admin entry, so that future agents and teammates do not keep using `5173/admin`.
50. As a project maintainer, I want local SQLite schema and initialization logic to be allowed to evolve for auth, so that the integration can prioritize a working demo loop.

## Implementation Decisions

- The current version is the integration base. Existing visitor-side route navigation, route drafts, tour-in-progress, tour recap, map support, and related data fields remain authoritative.
- The teammate version is authoritative for dual frontend entrypoints, visitor/admin authentication flow, admin permission enforcement, dashboard operations analytics, and related verification scripts.
- Visitor and admin apps will use separate frontend entrypoints selected at runtime or dev-server startup. The visitor app owns public visitor routes; the admin app owns management routes.
- The visitor app runs at `5173`. The admin app runs at `5174`. The backend remains at `8001`.
- Visitor app routes under `/admin` or `/admin/*` must not render management content. They should return the user to the visitor homepage or otherwise stay within the visitor app.
- Admin app formal routes use root paths: `/login`, `/dashboard`, `/spots`, `/routes`, `/knowledge`, `/logs`.
- Admin app compatibility routes under `/admin/login` and `/admin/*` may redirect to the new admin login or dashboard paths on the admin port.
- Visitor header removes the management entry. The visitor header shows public-only navigation before login and full visitor navigation after login.
- Visitor homepage remains public. Login and registration entry points are visible from the public homepage and visitor shell.
- Visitor protected paths include spots, spot details, routes, guide, route drafts, active tours, and tour recaps.
- Visitor protected paths are enforced in the frontend. Visitor business APIs keep their current access model and are not converted to backend-required visitor tokens in this PRD.
- Admin pages and admin APIs require administrator authentication. Admin token absence, invalidity, or expiry redirects the user to admin login.
- Visitor and admin auth share backend token infrastructure but enforce role-specific login behavior.
- Local default administrator provisioning is allowed through startup or bootstrap logic. Local SQLite structure and initialization may change to support authentication.
- Dashboard remains the single management data-screen entry. No new dashboard route or separate big-screen page is introduced.
- Dashboard integrates operations overview, visitor insights report, range switching, LLM status, empty states, and existing dashboard modules.
- Operations overview exposes service sessions, question counts, average satisfaction, sentiment trend, and satisfaction trend by time range.
- Visitor insights report exposes concern topics, representative questions, service suggestions, popular question clusters, LLM generation status, safe LLM errors, and rule summary.
- Time range support is limited to `today`, `week`, `7d`, and `30d`. Invalid ranges should fail with explicit API errors rather than silently producing ambiguous results.
- Rules remain the stable base for analytics. LLM is enhancement only and must degrade to rules when unavailable, unconfigured, or invalid.
- LLM popular-question clustering must only use real candidate visitor questions. It must not invent, rewrite, or introduce questions not present in logs.
- Non-dashboard admin pages retain current version behavior and visuals except for route path, shell, login, and token integration changes.
- Visitor internal pages retain current version behavior and visuals except where authentication context is necessary.
- Homepage, visitor login/register pages, and visitor shell typography/UI should align with the teammate version while preserving the current homepage's primary scenic visual structure.
- Startup scripts and documentation must consistently describe visitor at `5173`, admin at `5174`, and backend at `8001`.
- Existing public API path names, route navigation capabilities, map fields, TTS behavior, RAG answer path, and demo fallback paths should remain stable unless directly required for this integration.

## Testing Decisions

- Tests should verify external behavior rather than implementation details. Good tests assert route access, redirect behavior, response contracts, auth role boundaries, dashboard data shape, fallback behavior, and stable demo flows.
- Backend authentication tests should cover visitor registration, visitor login, admin login, wrong password rejection, visitor account rejection from admin login, token validation, and current-user lookup.
- Backend admin permission tests should cover unauthorized admin endpoint access, visitor-token rejection, and admin-token success.
- Backend dashboard tests should cover the existing dashboard summary plus the new operations overview and visitor insights endpoints.
- Operations overview tests should cover valid ranges, invalid ranges, service-session counting, question counting, sentiment trend, satisfaction trend, and null satisfaction for empty samples.
- Visitor insights tests should cover topic classification, representative question extraction, service suggestions, popular question clustering fallback, LLM-enhanced summary success, LLM failure fallback, and safe `llm_error` exposure.
- Frontend visitor auth verification should cover anonymous homepage access, hidden protected nav, visible login/register actions, protected-route redirects, login state, full nav after login, and logout.
- Frontend dual-entrypoint verification should cover `5173` visitor behavior and `5174` admin behavior, including the absence of management content on the visitor port.
- Frontend admin login verification should cover login form behavior, successful navigation to dashboard, invalid credentials, and expired/invalid token redirect.
- Frontend admin API auth verification should cover admin API requests carrying tokens and unauthorized responses returning the user to login.
- Frontend dashboard verification should cover range switching, operations KPI rendering, visitor insights sections, LLM status tags, service suggestions, popular question clusters, and empty states.
- Existing visitor flow verification should continue to cover home, spots, routes, guide, route drafts, active tour, and tour recap where available.
- Existing Live2D, source provenance, TTS, route recommendation, and map/navigation checks should continue to pass unless a failure exposes an unrelated existing issue.
- Build verification should include frontend TypeScript/build checks and backend pytest coverage for auth, admin dashboard, operations overview, and visitor insights.

## Out of Scope

- Replacing React, Vite, Ant Design, FastAPI, SQLite, or the existing project architecture is out of scope.
- Introducing a new database, vector database, charting library, or offline analytics pipeline is out of scope.
- Rebuilding visitor internal pages such as spots, routes, guide, route drafts, tour, and recap to match the teammate version visually is out of scope.
- Rebuilding non-dashboard admin pages beyond necessary route, shell, and auth integration is out of scope.
- Adding backend-required visitor token authorization to all visitor business APIs is out of scope.
- Removing or simplifying current route navigation, map, route draft, active tour, or recap features is out of scope.
- Moving large asset directories or changing public scenic knowledge source packages is out of scope.
- Changing public API names, environment variable names, or startup behavior beyond the confirmed dual-entry integration is out of scope.
- Storing real API keys, admin secrets, GitHub tokens, model credentials, TTS credentials, or visitor private data in repository files is out of scope.
- Adding new visitor feedback collection such as thumbs-up, thumbs-down, or explicit rating is out of scope, though it may be a future source for satisfaction scoring.

## Further Notes

- The integration should favor additive migration over file replacement. Current branch capabilities remain the base where there is overlap with the teammate branch.
- The dashboard analytics are intentionally structure-first and demo-stable: local rule analysis is the source of truth, while MiMo-compatible LLM output is an enhancement.
- Local demo databases may need schema updates or reinitialization after authentication integration. This is acceptable for this PRD as long as startup and verification documentation is clear.
- `frontend/dist` is a packaging artifact and should not become the source of truth for implementation.
- Documentation should be updated anywhere it still names `5173/admin` as the management entry.
- The accepted completion standard is a working dual-entry demo, preserved visitor navigation features, protected admin access, integrated dashboard analytics, updated scripts/docs, and passing relevant frontend and backend verification.
