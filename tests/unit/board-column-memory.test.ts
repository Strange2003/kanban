import { describe, expect, it } from "vitest";
import {
  DEFAULT_BOARD_COLUMNS,
  MAX_SKELETON_COLUMNS,
  boardColumnsKey,
  clampSkeletonColumns,
  readBoardColumns,
  writeBoardColumns,
} from "@/lib/board-column-memory";

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    map,
  };
}

const throwingStorage = {
  getItem: () => {
    throw new Error("SecurityError");
  },
  setItem: () => {
    throw new Error("QuotaExceededError");
  },
};

describe("boardColumnsKey", () => {
  it("is per project", () => {
    expect(boardColumnsKey("abc")).toBe("kanban:board-columns:abc");
    expect(boardColumnsKey("abc")).not.toBe(boardColumnsKey("xyz"));
  });
});

describe("clampSkeletonColumns", () => {
  it.each([
    [undefined, DEFAULT_BOARD_COLUMNS],
    [null, DEFAULT_BOARD_COLUMNS],
    ["", DEFAULT_BOARD_COLUMNS],
    ["abc", DEFAULT_BOARD_COLUMNS],
    ["0", DEFAULT_BOARD_COLUMNS],
    ["-2", DEFAULT_BOARD_COLUMNS],
    ["2.7", 2],
    ["5", 5],
    ["8", 8],
    ["12", MAX_SKELETON_COLUMNS],
    [4, 4],
    [Infinity, DEFAULT_BOARD_COLUMNS],
  ])("%j → %i", (value, expected) => {
    expect(clampSkeletonColumns(value)).toBe(expected);
  });
});

describe("readBoardColumns / writeBoardColumns", () => {
  it("round-trips the count per project", () => {
    const storage = memoryStorage();
    writeBoardColumns(storage, "p1", 5);
    writeBoardColumns(storage, "p2", 2);
    expect(readBoardColumns(storage, "p1")).toBe(5);
    expect(readBoardColumns(storage, "p2")).toBe(2);
    expect(readBoardColumns(storage, "never-seen")).toBe(DEFAULT_BOARD_COLUMNS);
  });

  it("stores the real count and caps it on read", () => {
    const storage = memoryStorage();
    writeBoardColumns(storage, "p1", 15);
    expect(storage.map.get(boardColumnsKey("p1"))).toBe("15");
    expect(readBoardColumns(storage, "p1")).toBe(MAX_SKELETON_COLUMNS);
  });

  it("keeps the previous value when the board is empty", () => {
    const storage = memoryStorage();
    writeBoardColumns(storage, "p1", 4);
    writeBoardColumns(storage, "p1", 0);
    expect(readBoardColumns(storage, "p1")).toBe(4);
  });

  it("never throws when storage fails or is missing", () => {
    expect(readBoardColumns(throwingStorage, "p1")).toBe(DEFAULT_BOARD_COLUMNS);
    expect(() => writeBoardColumns(throwingStorage, "p1", 4)).not.toThrow();
    expect(readBoardColumns(null, "p1")).toBe(DEFAULT_BOARD_COLUMNS);
    expect(() => writeBoardColumns(undefined, "p1", 4)).not.toThrow();
  });
});
