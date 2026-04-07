# Internal Blog: Built in <4 Hours With AI

Quick recap for Astrorei colleagues.

I built our internal blog MVP in less than 4 hours using AI to speed up implementation, while keeping architecture and product decisions manual.

## Scope

Target was simple:

- private/internal access only
- Google + Astrorei auth
- post + comment creation
- rich writing experience
- low-cost infra

## Stack

- **Next.js 16** (App Router + Server Actions)
- **TypeScript**
- **Supabase Auth**
- **Supabase Postgres** (`blog` schema + RLS)
- **Supabase Storage** (post images + profile avatars)
- **Tiptap** editor
- **Tailwind CSS**

## What Shipped

- Auth-gated blog (read/write for allowed users)
- Google + Astrorei login flow
- Rich post editor with:
	- headings, lists, task lists, quote, code, links
	- emoji picker + inline emoji suggestions
	- image upload to Supabase Storage
	- markdown shortcuts + markdown paste import
- Profiles:
	- username + avatar upload
	- Google avatar fallback
- Comments:
	- nested replies (Reddit-style)
	- upvote/downvote
- DB-level security via RLS policies

## Where AI Helped Most

- scaffolding and boilerplate generation
- Supabase schema/RLS iteration
- auth + callback troubleshooting
- rapid editor feature integration
- faster debug/fix loops

## Main Issues Solved

- OAuth redirect mismatch (env/callback alignment)
- custom schema/API exposure issues in Supabase
- editor SSR/render edge cases
- rendering/sanitizing rich content consistently

## Next Steps

1. Post edit/delete for authors
2. Search + tags + filters
3. Notification flow for replies
4. Draft/autosave workflow
5. Moderation tools
6. Better author/profile pages
7. Usage analytics

## Bottom Line

AI did not replace engineering work. It removed iteration friction.

Result: we moved from zero to a usable internal product quickly, with real auth, security, and a decent writing/commenting UX.
