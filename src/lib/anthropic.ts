import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface GeneratedNameResult {
  name: string;
  goodness: number;
}

/**
 * Uses Claude to generate creative name combinations from two input names.
 * Returns an array of generated names with goodness scores.
 */
export async function generateNameCombinations(
  name1: string,
  name2: string
): Promise<GeneratedNameResult[]> {
  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `You are "The Naminator" — a creative name combination generator.

Given two names, generate 6-8 creative combined names using techniques like:
- Concatenation (e.g., "John" + "Bob" = "JohnBob")
- Interleaving letters (e.g., "JBoohbn")
- Partial overlaps (e.g., "Johob" where shared letters merge)
- Portmanteau / blending (e.g., "Jocob")
- Reversed combination (e.g., "BobJohn")
- Creative mashups that sound like real names

For each generated name, also provide a "goodness" score from 0.0 to 5.0 based on:
- How pronounceable it is
- How natural it sounds as a name
- How creative/fun it is

The two input names are: "${name1}" and "${name2}"

Respond ONLY with valid JSON in this exact format (no markdown, no explanation):
[
  { "name": "ExampleName", "goodness": 3.5 },
  { "name": "AnotherName", "goodness": 4.2 }
]
Do NOT include any markdown code fences.  
`,

      },
    ],
  });

  // Extract the text content from the response
  const textBlock = message.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude");
  }

  // Parse the JSON response
  try {
    const results: GeneratedNameResult[] = JSON.parse(textBlock.text);

    // Validate the structure
    if (!Array.isArray(results)) {
      throw new Error("Response is not an array");
    }

    return results.map((r) => ({
      name: String(r.name),
      goodness: Math.round(Math.min(5, Math.max(0, Number(r.goodness))) * 10) / 10,
    }));
  } catch {
    console.error("Failed to parse Claude response:", textBlock.text);
    throw new Error("Failed to parse name combinations from AI response");
  }
}
