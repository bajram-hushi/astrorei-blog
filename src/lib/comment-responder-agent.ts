import OpenAI from "openai";

type CommentContext = {
  commentId: string;
  commentBody: string;
  commentAuthor: string;
  postId: string;
  postTitle: string;
  postContent: string;
  postAuthorId: string;
  parentCommentAuthorId?: string;
  commentChain: Array<{
    id: string;
    body: string;
    author: string;
    authorId: string;
    created_at: string;
  }>;
};

export type CommentResponseResult = {
  shouldRespond: boolean;
  response?: string;
  reasoning?: string;
};

export type CommentVoteResult = {
  shouldVote: boolean;
  vote?: 1 | -1;
  reasoning?: string;
};

function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function clip(input: string, max = 4000): string {
  if (input.length <= max) return input;
  return `${input.slice(0, max)}...[truncated]`;
}

/**
 * Check if a comment is directed at "rei" and generate a response if needed
 */
export async function shouldRespondToComment(
  context: CommentContext
): Promise<CommentResponseResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  const project = process.env.OPENAI_PROJECT?.trim();

  if (!apiKey) {
    console.error("comment-responder: OPENAI_API_KEY not configured");
    return { shouldRespond: false, reasoning: "API key not configured" };
  }

  const clientConfig: { apiKey: string; project?: string } = { apiKey };
  if (project) {
    clientConfig.project = project;
  }
  const client = new OpenAI(clientConfig);

  const botUserId = process.env.BLOG_WRITER_BOT_USER_ID?.trim();

  // Check if comment mentions "rei" or "@rei" or similar
  const body = context.commentBody.toLowerCase();
  const mentionsRei = body.includes("rei") || body.includes("@rei");

  // Check if this is a reply to Rei's comment
  const isReplyingToRei = context.parentCommentAuthorId === botUserId;

  // Check if this is a comment on Rei's post
  const isCommentingOnReiPost = context.postAuthorId === botUserId;

  if (!mentionsRei && !isReplyingToRei && !isCommentingOnReiPost) {
    return { 
      shouldRespond: false, 
      reasoning: "Comment does not mention rei, is not replying to rei, and is not on rei's post" 
    };
  }

  // Check if Rei already responded in this thread
  const reiAlreadyResponded = context.commentChain.some(
    (c) => c.authorId === botUserId
  );

  const triggerReason = mentionsRei 
    ? "mentioned by name" 
    : isReplyingToRei 
    ? "replying to Rei's comment" 
    : "commenting on Rei's post";

  console.log(`comment-responder: checking comment ${context.commentId} - trigger: ${triggerReason}, rei already responded: ${reiAlreadyResponded}`);

  const postContentClean = stripHtml(context.postContent);
  const commentChainText = context.commentChain
    .map((c) => `[${c.author}]: ${c.body}`)
    .join("\n");

  const systemPrompt = [
    "You are Rei, an AI agent that helps the Astrorei team on their internal blog ReiLabs.",
    "You are product-minded, direct, and helpful. You can answer questions, offer insights, and participate in discussions.",
    "",
    "Your job:",
    "1. Determine if the comment warrants a response from you",
    "2. If yes, write a helpful, contextual response in Italian",
    "",
    "Context:",
    `- This comment ${mentionsRei ? "mentions you by name" : isReplyingToRei ? "is a reply to your comment" : "is on a post you generated"}`,
    `- ${reiAlreadyResponded ? "You already responded earlier in this thread" : "This is your first response in this thread"}`,
    "",
    "Rules:",
    "- Be concise: 1-3 sentences unless more depth is needed",
    "- Stay on topic: refer to the post content and previous comments",
    "- Be consistent: maintain the same tone and stance throughout the thread",
    "- Don't repeat what others already said or what you already said",
    "- If someone is just replying to your comment to thank you or agree without a new question, you can skip responding",
    "- If commenting on your own post without asking you anything specific, you can skip responding",
    "- If the comment is off-topic or doesn't require your input, decline politely or skip",
    `- ${reiAlreadyResponded ? "Only respond again if there's a genuine new question or important clarification needed" : "Provide a helpful first response"}`,
    "",
    "Return ONLY strict JSON with this shape:",
    '{ "should_respond": true/false, "response": "your message in Italian or null", "reasoning": "why you decided to respond or not" }',
  ].join("\n");

  const userPrompt = [
    "## Post Context",
    `Title: ${context.postTitle}`,
    `Author: ${context.postAuthorId === botUserId ? "You (Rei)" : "Another user"}`,
    `Content: ${clip(postContentClean, 1500)}`,
    "",
    "## Comment Thread",
    commentChainText || "(no previous comments)",
    "",
    "## New Comment (the one you need to evaluate)",
    `From: ${context.commentAuthor}`,
    `Trigger: ${triggerReason}`,
    `Body: ${context.commentBody}`,
  ].join("\n");

  try {
    const completion = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      max_completion_tokens: 400,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content?.trim();
    if (!raw) {
      console.error("comment-responder: OpenAI returned empty response");
      return { shouldRespond: false, reasoning: "Empty AI response" };
    }

    const parsed = JSON.parse(raw) as {
      should_respond?: boolean;
      response?: string;
      reasoning?: string;
    };

    console.log(`comment-responder: decision=${parsed.should_respond}, reasoning=${parsed.reasoning}`);

    return {
      shouldRespond: !!parsed.should_respond,
      response: parsed.response || undefined,
      reasoning: parsed.reasoning || undefined,
    };
  } catch (error) {
    console.error("comment-responder: generation failed", {
      error,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return { shouldRespond: false, reasoning: "AI generation failed" };
  }
}

/**
 * Decide if Rei should vote on a comment (upvote/downvote)
 */
export async function shouldVoteOnComment(
  context: Omit<CommentContext, "commentId">
): Promise<CommentVoteResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  const project = process.env.OPENAI_PROJECT?.trim();

  if (!apiKey) {
    console.error("comment-voter: OPENAI_API_KEY not configured");
    return { shouldVote: false, reasoning: "API key not configured" };
  }

  const clientConfig: { apiKey: string; project?: string } = { apiKey };
  if (project) {
    clientConfig.project = project;
  }
  const client = new OpenAI(clientConfig);

  const botUserId = process.env.BLOG_WRITER_BOT_USER_ID?.trim();

  // Don't vote on your own comments
  const commentAuthorId = context.commentChain.find((c) => c.body === context.commentBody)?.authorId;
  if (commentAuthorId === botUserId) {
    return { shouldVote: false, reasoning: "Won't vote on own comment" };
  }

  const postContentClean = stripHtml(context.postContent);

  const systemPrompt = [
    "You are Rei, an AI agent on the Astrorei internal blog ReiLabs.",
    "Your job is to evaluate whether a comment deserves an upvote (+1) or downvote (-1).",
    "",
    "Vote criteria:",
    "",
    "UPVOTE (+1) when the comment:",
    "- Adds valuable insight or a new perspective",
    "- Is helpful, constructive, or educational",
    "- Shows thoughtful analysis relevant to the post",
    "- Asks a smart question that advances the discussion",
    "- Is funny/clever in a way that fits the context",
    "- Demonstrates good understanding of the topic",
    "",
    "DOWNVOTE (-1) when the comment:",
    "- Is off-topic or irrelevant to the post",
    "- Is low-effort spam or noise ('nice post', '+1', etc.)",
    "- Contains misinformation or bad advice",
    "- Is unnecessarily negative or unconstructive",
    "",
    "SKIP VOTING when:",
    "- The comment is neutral/average (not particularly good or bad)",
    "- It's a simple acknowledgment or thank-you",
    "- You're unsure about the context",
    "",
    "Return ONLY strict JSON with this shape:",
    '{ "should_vote": true/false, "vote": 1 or -1 or null, "reasoning": "brief explanation" }',
  ].join("\n");

  const userPrompt = [
    "## Post Context",
    `Title: ${context.postTitle}`,
    `Content: ${clip(postContentClean, 1200)}`,
    "",
    "## Comment to Evaluate",
    `From: ${context.commentAuthor}`,
    `Body: ${context.commentBody}`,
  ].join("\n");

  try {
    const completion = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.5,
      max_completion_tokens: 200,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content?.trim();
    if (!raw) {
      console.error("comment-voter: OpenAI returned empty response");
      return { shouldVote: false, reasoning: "Empty AI response" };
    }

    const parsed = JSON.parse(raw) as {
      should_vote?: boolean;
      vote?: number;
      reasoning?: string;
    };

    const vote = parsed.vote === 1 ? 1 : parsed.vote === -1 ? -1 : undefined;

    console.log(`comment-voter: decision=${parsed.should_vote}, vote=${vote}, reasoning=${parsed.reasoning}`);

    return {
      shouldVote: !!parsed.should_vote && !!vote,
      vote,
      reasoning: parsed.reasoning || undefined,
    };
  } catch (error) {
    console.error("comment-voter: generation failed", {
      error,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return { shouldVote: false, reasoning: "AI generation failed" };
  }
}

