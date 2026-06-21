import { AIMessage } from "../prompts/learner.prompt";

export async function callAIJson<T>(messages: AIMessage[]): Promise<T> {
  const apiUrl = process.env.AI_API_URL;
  const apiKey = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL;

  if (!apiUrl || !apiKey || !model) {
    throw new Error(
      "AI_API_URL, AI_API_KEY, atau AI_MODEL belum diisi di .env"
    );
  }

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.4
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`AI API error ${response.status}: ${errorBody}`);
  }

  const data = await response.json();
  const text = extractTextFromAIResponse(data);

  if (!text) {
    throw new Error("Response AI tidak mengandung text output.");
  }

  const cleaned = stripJsonCodeFence(text);
  return JSON.parse(cleaned) as T;
}

function extractTextFromAIResponse(data: unknown): string | null {
  const anyData = data as any;

  if (typeof anyData?.choices?.[0]?.message?.content === "string") {
    return anyData.choices[0].message.content;
  }

  if (typeof anyData?.output_text === "string") {
    return anyData.output_text;
  }

  if (typeof anyData?.text === "string") {
    return anyData.text;
  }

  if (Array.isArray(anyData?.output)) {
    const joined = anyData.output
      .map((item: any) => {
        if (typeof item?.content === "string") return item.content;
        if (typeof item?.text === "string") return item.text;
        return "";
      })
      .filter(Boolean)
      .join("\n");

    return joined || null;
  }

  return null;
}

function stripJsonCodeFence(text: string): string {
  return text
    .trim()
    .replace(/^```json/i, "")
    .replace(/^```/i, "")
    .replace(/```$/i, "")
    .trim();
}
