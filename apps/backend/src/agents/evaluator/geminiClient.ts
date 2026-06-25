import { GoogleGenerativeAI } from "@google/generative-ai";

export function createGeminiClient(apiKey: string) {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json",
    },
  });

  return {
    generate: async (prompt: string): Promise<string> => {
      const result = await model.generateContent(prompt);
      return result.response.text();
    },
  };
}
