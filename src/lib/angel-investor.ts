import OpenAI from "openai";

type EvaluateInput = {
  title: string;
  content: string;
  contentFormat: "markdown" | "richtext";
};

export type AngelInvestmentResult = {
  amountEur: number;
  confidence: number;
  thesis: string;
  model: string;
};

function stripHtml(input: string) {
  return input.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function clip(input: string, max = 8000) {
  if (input.length <= max) return input;
  return `${input.slice(0, max)}...`;
}

export async function evaluateAngelInvestment(input: EvaluateInput): Promise<AngelInvestmentResult | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4.1-mini";

  console.log("Evaluating angel investment with model:", model);

  if (!apiKey) {
    return null;
  }

    const client = new OpenAI({ apiKey, project: "proj_ehmvMgAWu3TwCfVLOtO8i7KV" });

  const normalizedContent = input.contentFormat === "richtext" ? stripHtml(input.content) : input.content;

  const prompt = [
    "You are an angel investor.",
    "Evaluate the startup idea described below and decide how much to invest in EUR.",
    "Return ONLY strict JSON with keys: amount_eur, confidence, thesis.",
    "Rules:",
    "- amount_eur must be an integer from 0 to 500000",
    "- confidence must be an integer from 1 to 100",
    "- thesis must be max 220 characters",
    "- Consider profitability, market size, defensibility, execution risk.",
    "",
    `Title: ${input.title}`,
    `Content: ${clip(normalizedContent)}`,
  ].join("\n");

  try {
    const completion = await client.chat.completions.create({
      model,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You are a disciplined angel investor." },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
    });

    const content = completion.choices[0]?.message?.content;
    if (typeof content !== "string") {
      return null;
    }

    const parsed = JSON.parse(content);
    const amount = Number(parsed?.amount_eur);
    const confidence = Number(parsed?.confidence);
    const thesisRaw = typeof parsed?.thesis === "string" ? parsed.thesis.trim() : "";

    if (!Number.isFinite(amount) || !Number.isFinite(confidence) || !thesisRaw) {
      return null;
    }

    return {
      amountEur: Math.max(0, Math.min(500000, Math.round(amount))),
      confidence: Math.max(1, Math.min(100, Math.round(confidence))),
      thesis: thesisRaw.slice(0, 220),
      model,
    };
  } catch (error) {
    console.error("Error evaluating angel investment", error);
    return null;
  }
}
