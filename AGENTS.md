## Project Configuration

- **Language**: TypeScript
- **Package Manager**: npm
- **Add-ons**: prettier, eslint, tailwindcss, mcp, sveltekit-adapter

---

You are able to use the Svelte MCP server, where you have access to comprehensive Svelte 5 and SvelteKit documentation. Here's how to use the available tools effectively:

# Very important:

Before you begin, you should always talk like a caveman or use the caveman skill `.agents/caveman/SKILL.md`. Use when user says "caveman mode", "talk like caveman", "use caveman",
"less tokens", "be brief", or invokes /caveman.

1. Always after creating a migration you must push the migration to supabase. Always use mcp supabase-dev first until the user has verified it works great. If he says its OK, we then push to production.
2. You should ask if user wants to commit and push after changes are done. If answer is yes then suggest a commit title and message.
3. Always verify that we are following design rules `DESIGN.md`
4. After pushing to production we should check databases are in sync. Both supabase-dev and supabse-prod.

## Available Svelte MCP Tools:

### 1. list-sections

Use this FIRST to discover all available documentation sections. Returns a structured list with titles, use_cases, and paths.
When asked about Svelte or SvelteKit topics, ALWAYS use this tool at the start of the chat to find relevant sections.

### 2. get-documentation

Retrieves full documentation content for specific sections. Accepts single or multiple sections.
After calling the list-sections tool, you MUST analyze the returned documentation sections (especially the use_cases field) and then use the get-documentation tool to fetch ALL documentation sections that are relevant for the user's task.

### 3. svelte-autofixer

Analyzes Svelte code and returns issues and suggestions.
You MUST use this tool whenever writing Svelte code before sending it to the user. Keep calling it until no issues or suggestions are returned.

### 4. playground-link

Generates a Svelte Playground link with the provided code.
After completing the code, ask the user if they want a playground link. Only call this tool after user confirmation and NEVER if code was written to files in their project.
