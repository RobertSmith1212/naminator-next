import "@testing-library/jest-dom";
import { TextEncoder, TextDecoder } from "util";
import { beforeEach, afterEach, vi } from "vitest";
Object.assign(globalThis, { TextEncoder, TextDecoder });

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});
