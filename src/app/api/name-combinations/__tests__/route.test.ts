// @vitest-environment node

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock all external dependencies before importing the route
vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    nameCombinationSet: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/anthropic", () => ({
  generateNameCombinations: vi.fn(),
}));

import { POST, GET } from "@/app/api/name-combinations/route";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateNameCombinations } from "@/lib/anthropic";

const mockAuth = vi.mocked(auth);
const mockCreate = vi.mocked(prisma.nameCombinationSet.create);
const mockFindMany = vi.mocked(prisma.nameCombinationSet.findMany);
const mockGenerateCombinations = vi.mocked(generateNameCombinations);

// Helper to build a POST request
function makePostRequest(body: unknown, bodyStr?: string) {
  const rawBody = bodyStr ?? JSON.stringify(body);
  return new NextRequest("http://localhost/api/name-combinations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: rawBody,
  });
}

// Helper to build a GET request
function makeGetRequest() {
  return new NextRequest("http://localhost/api/name-combinations");
}

// A sample Prisma create result
const sampleCreatedSet = {
  id: 1,
  name1: "John",
  name2: "Jane",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  userId: "user-123",
  results: [{ id: 10, name: "Jocob", goodness: 4.2, setId: 1 }],
};

// A sample Prisma findMany result
const sampleFoundSets = [
  {
    id: 1,
    name1: "John",
    name2: "Jane",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    userId: "user-123",
    results: [{ id: 10, name: "Jocob", goodness: 4.2, setId: 1 }],
  },
];

describe("POST /api/name-combinations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ------------------------------------------------------------------
  // Authentication
  // ------------------------------------------------------------------

  describe("authentication", () => {
    it("returns 401 when auth() returns null", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockAuth.mockResolvedValueOnce(null as any);
      const req = makePostRequest({ name1: "John", name2: "Jane" });
      const res = await POST(req);
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body).toEqual({ error: "Unauthorized" });
    });

    it("returns 401 when auth() returns session without user.id", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockAuth.mockResolvedValueOnce({ user: {} } as any);
      const req = makePostRequest({ name1: "John", name2: "Jane" });
      const res = await POST(req);
      expect(res.status).toBe(401);
    });

    it("returns 401 when auth() returns session with null user", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockAuth.mockResolvedValueOnce({ user: null } as any);
      const req = makePostRequest({ name1: "John", name2: "Jane" });
      const res = await POST(req);
      expect(res.status).toBe(401);
    });
  });

  // ------------------------------------------------------------------
  // Request body validation
  // ------------------------------------------------------------------

  describe("request body validation", () => {
    beforeEach(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockAuth.mockResolvedValue({ user: { id: "user-123" } } as any);
    });

    it("returns 400 with 'Invalid JSON' message when body is malformed", async () => {
      const req = makePostRequest(null, "not valid json");
      const res = await POST(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/invalid json/i);
    });

    it("returns 400 when name1 is missing from body", async () => {
      const req = makePostRequest({ name2: "Jane" });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/name1/i);
    });

    it("returns 400 when name1 is an empty string", async () => {
      const req = makePostRequest({ name1: "", name2: "Jane" });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("returns 400 when name1 is whitespace only", async () => {
      const req = makePostRequest({ name1: "   ", name2: "Jane" });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("returns 400 when name1 is not a string", async () => {
      const req = makePostRequest({ name1: 42, name2: "Jane" });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("returns 400 when name2 is missing from body", async () => {
      const req = makePostRequest({ name1: "John" });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/name2/i);
    });

    it("returns 400 when name2 is an empty string", async () => {
      const req = makePostRequest({ name1: "John", name2: "" });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("returns 400 when name2 is whitespace only", async () => {
      const req = makePostRequest({ name1: "John", name2: "   " });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("returns 400 when name2 is not a string", async () => {
      const req = makePostRequest({ name1: "John", name2: 99 });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });
  });

  // ------------------------------------------------------------------
  // Successful POST
  // ------------------------------------------------------------------

  describe("successful POST", () => {
    beforeEach(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockAuth.mockResolvedValue({ user: { id: "user-123" } } as any);
      mockGenerateCombinations.mockResolvedValue([
        { name: "Jocob", goodness: 4.2 },
      ]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockCreate.mockResolvedValue(sampleCreatedSet as any);
    });

    it("calls generateNameCombinations with trimmed names", async () => {
      const req = makePostRequest({ name1: "  John  ", name2: "  Jane  " });
      await POST(req);
      expect(mockGenerateCombinations).toHaveBeenCalledWith("John", "Jane");
    });

    it("calls prisma.nameCombinationSet.create with correct data shape", async () => {
      const req = makePostRequest({ name1: "John", name2: "Jane" });
      await POST(req);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name1: "John",
            name2: "Jane",
            userId: "user-123",
            results: {
              create: [{ name: "Jocob", goodness: 4.2 }],
            },
          }),
        })
      );
    });

    it("calls prisma create with include: { results: true }", async () => {
      const req = makePostRequest({ name1: "John", name2: "Jane" });
      await POST(req);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          include: { results: true },
        })
      );
    });

    it("returns 200 with correctly shaped response body", async () => {
      const req = makePostRequest({ name1: "John", name2: "Jane" });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toMatchObject({
        id: 1,
        name1: "John",
        name2: "Jane",
        results: [{ id: 10, name: "Jocob", goodness: 4.2 }],
      });
    });

    it("includes createdAt in the response body", async () => {
      const req = makePostRequest({ name1: "John", name2: "Jane" });
      const res = await POST(req);
      const body = await res.json();
      expect(body.createdAt).toBeDefined();
    });

    it("response results only contain id, name, goodness", async () => {
      const req = makePostRequest({ name1: "John", name2: "Jane" });
      const res = await POST(req);
      const body = await res.json();
      const resultKeys = Object.keys(body.results[0]).sort();
      expect(resultKeys).toEqual(["goodness", "id", "name"]);
    });
  });

  // ------------------------------------------------------------------
  // Error handling
  // ------------------------------------------------------------------

  describe("error handling", () => {
    beforeEach(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockAuth.mockResolvedValue({ user: { id: "user-123" } } as any);
    });

    it("returns 500 when generateNameCombinations throws", async () => {
      mockGenerateCombinations.mockRejectedValueOnce(new Error("Claude failed"));
      const req = makePostRequest({ name1: "John", name2: "Jane" });
      const res = await POST(req);
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toMatch(/failed to generate/i);
    });

    it("returns 500 when prisma.create throws", async () => {
      mockGenerateCombinations.mockResolvedValueOnce([
        { name: "Jocob", goodness: 4.2 },
      ]);
      mockCreate.mockRejectedValueOnce(new Error("DB error"));
      const req = makePostRequest({ name1: "John", name2: "Jane" });
      const res = await POST(req);
      expect(res.status).toBe(500);
    });
  });
});

// ====================================================================

describe("GET /api/name-combinations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ------------------------------------------------------------------
  // Authentication
  // ------------------------------------------------------------------

  describe("authentication", () => {
    it("returns 401 when auth() returns null", async () => {
      mockAuth.mockResolvedValueOnce(null);
      const res = await GET();
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body).toEqual({ error: "Unauthorized" });
    });

    it("returns 401 when session has no user.id", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockAuth.mockResolvedValueOnce({ user: {} } as any);
      const res = await GET();
      expect(res.status).toBe(401);
    });
  });

  // ------------------------------------------------------------------
  // Successful GET
  // ------------------------------------------------------------------

  describe("successful GET", () => {
    beforeEach(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockAuth.mockResolvedValue({ user: { id: "user-123" } } as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockFindMany.mockResolvedValue(sampleFoundSets as any);
    });

    it("calls findMany with the authenticated user's ID", async () => {
      await GET();
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: "user-123" },
        })
      );
    });

    it("calls findMany with include: { results: true }", async () => {
      await GET();
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: { results: true },
        })
      );
    });

    it("calls findMany with orderBy: { createdAt: 'desc' }", async () => {
      await GET();
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: "desc" },
        })
      );
    });

    it("returns 200 with correctly shaped array response", async () => {
      const res = await GET();
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body)).toBe(true);
      expect(body).toHaveLength(1);
      expect(body[0]).toMatchObject({
        id: 1,
        name1: "John",
        name2: "Jane",
        results: [{ id: 10, name: "Jocob", goodness: 4.2 }],
      });
    });

    it("returns empty array when user has no history", async () => {
      mockFindMany.mockResolvedValueOnce([]);
      const res = await GET();
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual([]);
    });

    it("response results only contain id, name, goodness", async () => {
      const res = await GET();
      const body = await res.json();
      const resultKeys = Object.keys(body[0].results[0]).sort();
      expect(resultKeys).toEqual(["goodness", "id", "name"]);
    });
  });

  // ------------------------------------------------------------------
  // Error handling
  // ------------------------------------------------------------------

  describe("error handling", () => {
    it("returns 500 when prisma.findMany throws", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockAuth.mockResolvedValue({ user: { id: "user-123" } } as any);
      mockFindMany.mockRejectedValueOnce(new Error("DB is down"));
      const res = await GET();
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toMatch(/failed to fetch/i);
    });
  });
});
