# Rei Comment Responder & Voter Setup

Rei is an AI agent that automatically responds to comments when mentioned on ReiLabs, and votes on comments based on their quality and relevance.

## How it works

### Auto-responding

When someone posts a comment, Rei checks if it should respond based on three triggers:
1. **Direct mention**: Comment contains "rei" or "@rei"
2. **Reply to Rei**: Comment is a reply to one of Rei's comments
3. **Comment on Rei's post**: Comment is on a post that Rei generated

If any trigger matches, the system:
1. Fetches the post content and full comment thread
2. Calls the OpenAI API to determine if Rei should respond
3. If yes, generates a contextual response in Italian
4. Posts the response as a reply from the bot user account

Rei is smart about when to respond - it won't spam threads with unnecessary replies. It skips responding when:
- Someone just says "grazie" or agrees without a new question
- The comment doesn't require Rei's input
- Rei already answered the same question earlier in the thread

### Auto-voting

For **every new comment** (except Rei's own), Rei evaluates whether to upvote or downvote:

**Upvotes (+1)** comments that:
- Add valuable insight or new perspective
- Are helpful, constructive, or educational
- Show thoughtful analysis relevant to the post
- Ask smart questions that advance discussion
- Are funny/clever in context
- Demonstrate good understanding

**Downvotes (-1)** comments that:
- Are off-topic or irrelevant
- Are low-effort spam ("nice post", "+1", etc.)
- Contain misinformation or bad advice
- Are unnecessarily negative or unconstructive

**Skips voting** when:
- The comment is neutral/average
- It's a simple acknowledgment or thank-you
- Context is unclear

## Required setup

### 1. Create the bot user in Supabase

The bot needs a real user account in your Supabase `auth.users` table.

**Option A: Via Supabase dashboard**
1. Go to Authentication → Users
2. Add user manually with email `rei@astrorei.io` (or your preferred email)
3. Copy the user UUID

**Option B: Via SQL**
```sql
-- Insert bot user (adjust email/password as needed)
INSERT INTO auth.users (
  email, 
  encrypted_password, 
  email_confirmed_at,
  raw_user_meta_data
) VALUES (
  'rei@astrorei.io',
  crypt('random-secure-password', gen_salt('bf')),
  now(),
  '{"full_name": "Rei"}'::jsonb
) RETURNING id;
```

Copy the returned UUID.

### 2. Create bot profile (optional but recommended)

```sql
-- Create profile for bot with username and avatar
INSERT INTO blog.profiles (id, email, username, avatar_url)
VALUES (
  '<UUID_FROM_STEP_1>',
  'rei@astrorei.io',
  'Rei',
  'https://your-domain.com/rei-avatar.png'  -- optional
);
```

### 3. Set environment variables

Add these to your `.env` or production environment:

```bash
# Required: UUID of the bot user from step 1
BLOG_WRITER_BOT_USER_ID=<UUID_FROM_STEP_1>

# Optional: email shown as comment author (defaults to rei@astrorei.io)
BLOG_WRITER_AUTHOR_EMAIL=rei@astrorei.io

# Already required for blog writer
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini  # optional, defaults to this
```

## Testing

### Trigger 1: Direct mention
1. Create a post (by any user)
2. Add a comment mentioning "rei": 
   - "Ehi @rei, cosa ne pensi?"
   - "Rei, puoi spiegare meglio questa parte?"
3. Wait 2-3 seconds for the AI to process
4. Rei should reply as a nested comment

### Trigger 2: Reply to Rei's comment
1. Wait for Rei to comment on any post (or trigger a response)
2. Reply to Rei's comment with any message
3. Rei may respond if the reply contains a new question or needs clarification

### Trigger 3: Comment on Rei's post
1. Click "Genera con AI" to create a post by Rei
2. Add a comment on that post
3. Rei may respond depending on whether your comment needs input

## Behavior

### Responding
- **Responds to three triggers**: 
  1. Direct mention ("rei" or "@rei" in comment body)
  2. Reply to Rei's comment
  3. Comment on Rei's generated post
- **Contextual**: Reads the full post and comment thread before responding
- **Selective**: Won't respond to simple thank-yous or when no input is needed
- **Avoids repetition**: Won't respond if already replied in the same thread unless there's a new question
- **Italian**: Responds in Italian by default

### Voting
- **Votes on all comments**: Evaluates every comment except its own
- **Quality-based**: Upvotes valuable contributions, downvotes spam/off-topic
- **Objective**: Uses clear criteria (insight, relevance, constructiveness)
- **Conservative**: Skips voting when comment is average or unclear

### Reliability
- **Fails silently**: If AI calls fail, the user's comment still posts normally
- **No blocking**: Rei's actions never prevent users from posting

## Logs

Check server logs for:

**Responding:**
- `comment-responder: checking comment <id>` - when a mention is detected
- `comment-responder: Rei will respond` - when a response is generated
- `comment-responder: Rei will not respond - <reason>` - when skipped

**Voting:**
- `comment-voter: Rei will vote +1 on comment <id>` - upvote
- `comment-voter: Rei will vote -1 on comment <id>` - downvote
- `comment-voter: Rei will not vote - <reason>` - skipped

## Costs

Each comment triggers up to two OpenAI API calls:
- **Response check** (~400 tokens): when comment mentions/replies to Rei or is on Rei's post
- **Vote decision** (~200 tokens): for every new comment

With `gpt-4o-mini`:
- Response: ~$0.0001 per check
- Vote: ~$0.00005 per comment
- Total per comment: ~$0.00015 worst case (both calls)

## Vote Examples

**Upvotes (+1):**
- "Great point! This aligns with what we saw with the X feature - maybe we could combine them?"
- "Ho provato questo approccio e ho notato che funziona meglio se aggiungi Y"
- "Why did you choose approach A over B? I'm curious about the tradeoffs"
- "This is brilliant! It reminds me of how [other project] solved this" 😂

**Downvotes (-1):**
- "Nice post +1" (low effort)
- "Check out my blog at [spam link]" (spam)
- "This is completely wrong, X doesn't work like that" (when X actually does work that way)
- "Why would anyone build this?" (unconstructive)

**No vote:**
- "Grazie per l'articolo!" (simple acknowledgment)
- "Interessante" (neutral)
- "Ho una domanda simile" (needs context)
