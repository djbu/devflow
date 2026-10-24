Read AGENTS.md. Replace temporary configuration with persisted Zaps.
Target: 80 minutes.

Mandatory API and Angular UI:
- List, create, and edit owned Zaps.
- Configure name, repository, trigger, action, and enabled state.
- Edit comment templates and insert supported mapping variables.
- Include several developer tools in the picker; unsupported options are
  clearly unavailable and cannot be enabled through the API.
- Provide loading, empty, saving, and error states.

Scope every operation to the session user. Validate repository connection
ownership and configuration on the backend. Resolve webhook deliveries through
authorized connections and execute only enabled Zaps for the matching repository.
Use persisted Zap IDs in the unique (zapId, deliveryId) execution key.

Allow only {{pr.title}}, {{pr.author}}, {{pr.url}}, and
{{repository.fullName}}. Map these to pull_request.title,
pull_request.user.login, pull_request.html_url, and repository.full_name.
Example: Thanks {{pr.author}} for opening "{{pr.title}}"!
Reject unknown/malformed placeholders; never evaluate expressions or code.

Test another user's Zap access, repository connection ownership, disabled Zaps,
valid/invalid templates, and correct event-data mapping. Re-verify the real flow
with a persisted Zap; the earlier temporary integration is insufficient evidence.

Optional only if mandatory behavior is complete: comment preview and latest
execution display. Keep records minimal; no execution dashboard or general
workflow engine. Copilot remains last. Do not commit automatically.
