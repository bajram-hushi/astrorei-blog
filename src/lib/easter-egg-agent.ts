import OpenAI from "openai";

const FALLBACK_EASTER_MESSAGES = [
  "Idea captata. Il laboratorio e sveglio.",
  "ReiLabs ha intercettato un segnale creativo.",
  "Doppio click confermato. Modalita founder attivata.",
  "Un progetto ti sta cercando.",
  "Questa notifica non doveva esistere. Ed eccola qui.",
  "Anomalia rilevata: entusiasmo operativo fuori soglia.",
];

function randomFallbackMessage() {
  return FALLBACK_EASTER_MESSAGES[Math.floor(Math.random() * FALLBACK_EASTER_MESSAGES.length)];
}

export async function generateEasterEggMessage() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4.1-mini";

  if (!apiKey) {
    return randomFallbackMessage();
  }

  const client = new OpenAI({ apiKey, project: "proj_ehmvMgAWu3TwCfVLOtO8i7KV" });

  try {
    const completion = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content:
            "You are a micro-copy agent for ReiLabs. You write short Italian easter egg push notifications for founders and builders.",
        },
        {
          role: "user",
          content: [
            "Write exactly one short push notification message in Italian.",
            "Tone: clever, playful, product-lab, slightly mysterious.",
            "Constraints:",
            "- 1 sentence only",
            "- max 90 characters",
            "- no emojis",
            "- no quotes",
            "- no hashtags",
            "- avoid repeating these exact lines:",
            ...FALLBACK_EASTER_MESSAGES.map((message) => `  - ${message}`),
            "The message should feel like a secret signal from an internal startup lab.",
            "Return only the message text.",
          ].join("\n"),
        },
      ],
      temperature: 1,
      max_tokens: 60,
    });

    const message = completion.choices[0]?.message?.content?.trim();
    if (!message) {
      return randomFallbackMessage();
    }

    return message.replace(/^"|"$/g, "").slice(0, 90);
  } catch (error) {
    console.error("Error generating easter egg message", error);
    return randomFallbackMessage();
  }
}