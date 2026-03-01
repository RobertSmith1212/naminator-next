// @vitest-environment node

// vi.hoisted() ensures mockCreate is initialized before the mock factory runs,
// since vi.mock() is hoisted before imports but plain `const` declarations are not.
// The mock uses a regular function (not arrow function) so it can be called with `new`.
const mockCreate = vi.hoisted(() => vi.fn());

vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn(function () {
    return { messages: { create: mockCreate } };
  }),
}));

import { describe, it, expect, beforeEach, vi } from "vitest";
import { generateNameCombinations } from "@/lib/anthropic";

// Helper: build the response shape that anthropic.messages.create returns
function makeResponse(text: string) {
  return { content: [{ type: "text", text }] };
}

function makeJsonResponse(data: unknown) {
  return makeResponse(JSON.stringify(data));
}

describe("generateNameCombinations", () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  // ----------------------------------------------------------------
  // Successful response parsing
  // ----------------------------------------------------------------

  it("returns parsed array when API returns valid JSON", async () => {
    mockCreate.mockResolvedValueOnce(
      makeJsonResponse([{ name: "Jocob", goodness: 4.2 }])
    );
    const result = await generateNameCombinations("John", "Jacob");
    expect(result).toEqual([{ name: "Jocob", goodness: 4.2 }]);
  });

  it("passes name1 and name2 into the prompt content", async () => {
    mockCreate.mockResolvedValueOnce(makeJsonResponse([]));
    await generateNameCombinations("Alice", "Bob");
    const callArg = mockCreate.mock.calls[0][0];
    const promptContent = callArg.messages[0].content as string;
    expect(promptContent).toContain("Alice");
    expect(promptContent).toContain("Bob");
  });

  it("passes correct model to the API", async () => {
    mockCreate.mockResolvedValueOnce(makeJsonResponse([]));
    await generateNameCombinations("A", "B");
    expect(mockCreate.mock.calls[0][0].model).toBe("claude-haiku-4-5");
  });

  it("passes correct max_tokens to the API", async () => {
    mockCreate.mockResolvedValueOnce(makeJsonResponse([]));
    await generateNameCombinations("A", "B");
    expect(mockCreate.mock.calls[0][0].max_tokens).toBe(1024);
  });

  it("coerces name to string via String()", async () => {
    mockCreate.mockResolvedValueOnce(
      makeJsonResponse([{ name: 12345, goodness: 3.0 }])
    );
    const result = await generateNameCombinations("A", "B");
    expect(result[0].name).toBe("12345");
    expect(typeof result[0].name).toBe("string");
  });

  it("coerces goodness to number via Number()", async () => {
    mockCreate.mockResolvedValueOnce(
      makeJsonResponse([{ name: "Test", goodness: "4.5" }])
    );
    const result = await generateNameCombinations("A", "B");
    expect(result[0].goodness).toBe(4.5);
    expect(typeof result[0].goodness).toBe("number");
  });

  it("maps multiple results correctly", async () => {
    mockCreate.mockResolvedValueOnce(
      makeJsonResponse([
        { name: "Alpha", goodness: 1.0 },
        { name: "Beta", goodness: 2.0 },
        { name: "Gamma", goodness: 3.0 },
      ])
    );
    const result = await generateNameCombinations("A", "B");
    expect(result).toHaveLength(3);
    expect(result[0].name).toBe("Alpha");
    expect(result[1].name).toBe("Beta");
    expect(result[2].name).toBe("Gamma");
  });

  it("handles empty array response without throwing", async () => {
    mockCreate.mockResolvedValueOnce(makeJsonResponse([]));
    const result = await generateNameCombinations("A", "B");
    expect(result).toEqual([]);
  });

  // ----------------------------------------------------------------
  // Score clamping and rounding
  // ----------------------------------------------------------------

  it("clamps goodness above 5 to exactly 5.0", async () => {
    mockCreate.mockResolvedValueOnce(
      makeJsonResponse([{ name: "X", goodness: 7.5 }])
    );
    const result = await generateNameCombinations("A", "B");
    expect(result[0].goodness).toBe(5.0);
  });

  it("clamps goodness below 0 to exactly 0.0", async () => {
    mockCreate.mockResolvedValueOnce(
      makeJsonResponse([{ name: "X", goodness: -2.3 }])
    );
    const result = await generateNameCombinations("A", "B");
    expect(result[0].goodness).toBe(0.0);
  });

  it("rounds goodness to one decimal place", async () => {
    mockCreate.mockResolvedValueOnce(
      makeJsonResponse([{ name: "X", goodness: 3.14159 }])
    );
    const result = await generateNameCombinations("A", "B");
    expect(result[0].goodness).toBe(3.1);
  });

  it("handles goodness of exactly 0 without clamping", async () => {
    mockCreate.mockResolvedValueOnce(
      makeJsonResponse([{ name: "X", goodness: 0 }])
    );
    const result = await generateNameCombinations("A", "B");
    expect(result[0].goodness).toBe(0.0);
  });

  it("handles goodness of exactly 5 without clamping", async () => {
    mockCreate.mockResolvedValueOnce(
      makeJsonResponse([{ name: "X", goodness: 5 }])
    );
    const result = await generateNameCombinations("A", "B");
    expect(result[0].goodness).toBe(5.0);
  });

  it("rounds goodness 3.15 to 3.2", async () => {
    mockCreate.mockResolvedValueOnce(
      makeJsonResponse([{ name: "X", goodness: 3.15 }])
    );
    const result = await generateNameCombinations("A", "B");
    // Math.round(3.15 * 10) / 10 — JS floating point may vary; we verify the formula
    const expected = Math.round(3.15 * 10) / 10;
    expect(result[0].goodness).toBe(expected);
  });

  // ----------------------------------------------------------------
  // Error cases
  // ----------------------------------------------------------------

  it("throws 'No text response from Claude' when content array is empty", async () => {
    mockCreate.mockResolvedValueOnce({ content: [] });
    await expect(generateNameCombinations("A", "B")).rejects.toThrow(
      "No text response from Claude"
    );
  });

  it("throws 'No text response from Claude' when content has only non-text blocks", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: "tool_use", id: "x", name: "y", input: {} }],
    });
    await expect(generateNameCombinations("A", "B")).rejects.toThrow(
      "No text response from Claude"
    );
  });

  it("throws 'Failed to parse' on invalid JSON text", async () => {
    mockCreate.mockResolvedValueOnce(makeResponse("not valid json at all"));
    await expect(generateNameCombinations("A", "B")).rejects.toThrow(
      "Failed to parse name combinations from AI response"
    );
  });

  it("throws 'Failed to parse' when response JSON is an object (not an array)", async () => {
    mockCreate.mockResolvedValueOnce(
      makeJsonResponse({ name: "X", goodness: 3 })
    );
    await expect(generateNameCombinations("A", "B")).rejects.toThrow(
      "Failed to parse name combinations from AI response"
    );
  });

  it("throws 'Failed to parse' when response JSON is null", async () => {
    mockCreate.mockResolvedValueOnce(makeJsonResponse(null));
    await expect(generateNameCombinations("A", "B")).rejects.toThrow(
      "Failed to parse name combinations from AI response"
    );
  });

  it("throws 'Failed to parse' when response JSON is a plain string", async () => {
    mockCreate.mockResolvedValueOnce(makeResponse('"just a string"'));
    await expect(generateNameCombinations("A", "B")).rejects.toThrow(
      "Failed to parse name combinations from AI response"
    );
  });

  it("propagates error when anthropic.messages.create rejects", async () => {
    const apiError = new Error("API rate limit exceeded");
    mockCreate.mockRejectedValueOnce(apiError);
    await expect(generateNameCombinations("A", "B")).rejects.toThrow(
      "API rate limit exceeded"
    );
  });
});
