# Project instructions

- Stack: TypeScript, npm, SvelteKit, Tailwind CSS, ESLint and Prettier.
- Communicate using the `caveman` skill.
- For new features, use the `grill-with-docs` skill.
- For UI changes, follow `DESIGN.md`.
- After changes, ask whether the user wants to commit and push. If yes, suggest a commit title and message.

## Supabase migrations

- After creating a migration, apply it to `supabase-dev` first.
- Apply it to production only after the user confirms it works well.
- After applying to production, check that dev and production databases are in sync.

## Svelte

- Use the Svelte MCP server for Svelte development: discover relevant documentation with `list-sections`, then retrieve it with `get-documentation`.
- Validate written Svelte code with `svelte-autofixer` until issues are resolved.
- Offer a playground link only when code was not written to project files; create it only after user confirmation.

## Context management

- Use available context-mode tools to process large outputs, search indexed content, and resume prior context. Print only relevant results.
- Use dedicated tools for edits and small reads; avoid dumping large files or command outputs into the conversation.
- Run independent network requests concurrently when supported; avoid concurrent operations that share mutable state.
- Keep artifacts in files when a file deliverable is requested; answer ordinary questions in chat.
