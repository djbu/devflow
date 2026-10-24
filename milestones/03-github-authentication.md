Read AGENTS.md. Implement GitHub OAuth with server-side sessions.
Target: 40 minutes.

Include:
- Authorization redirect and callback with OAuth state validation.
- User persistence and protected backend-only credential storage.
- HttpOnly session cookie, current-user endpoint, and logout.
- Authentication middleware for private endpoints.
- Minimal Angular login and signed-in views.

Keep tokens out of frontend data, logs, and error responses. Use the existing
MongoDB for persisted sessions if persistence is needed; add no new infrastructure.
Document exact callback configuration, implemented credential protection,
and scopes needed for repository access, PR comments, and hook management.
State any repository visibility or permission restrictions explicitly.

Test invalid OAuth state and unauthenticated access. Verify actual sign-in
using the user's GitHub account and distinguish it from mocked tests.
Do not implement the Zap builder or commit automatically.
