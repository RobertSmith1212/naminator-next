// @vitest-environment node

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

describe("Prisma Database", () => {

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("creates and reads a full NameCombinationSet", async () => {

    // 1. Create User
    const user = await prisma.user.create({
      data: {
        email: "test@example.com",
        name: "Test User",
      },
    });

    // 2. Create NameCombinationSet
    const set = await prisma.nameCombinationSet.create({
      data: {
        name1: "John",
        name2: "Jacob",
        userId: user.id,
      },
    });

    // 3. Create GeneratedName
    const result = await prisma.generatedName.create({
      data: {
        name: "Jocob",
        goodness: 4.5,
        setId: set.id,
      },
    });

    expect(result.id).toBeDefined();

    // 4. Read back with relations
    const foundSet = await prisma.nameCombinationSet.findUnique({
      where: { id: set.id },
      include: {
        results: true,
        user: true,
      },
    });

    expect(foundSet?.name1).toBe("John");
    expect(foundSet?.results.length).toBe(1);
    expect(foundSet?.results[0].name).toBe("Jocob");
    expect(foundSet?.user.email).toBe("test@example.com");

    // 5. Cleanup (cascade deletes results automatically)
    await prisma.user.delete({
      where: { id: user.id },
    });

  });

});