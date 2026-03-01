import "@testing-library/jest-dom";
import { TextEncoder, TextDecoder } from "util";
import { beforeEach, afterEach, vi } from "vitest";
import "dotenv/config";

Object.assign(globalThis, { TextEncoder, TextDecoder });

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});
