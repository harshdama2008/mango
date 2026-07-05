import { JSONContent } from "@tiptap/react";
import {
  countDistinctAttachedFiles,
  getMessageTextLength,
} from "./countAttachedFiles";

function doc(...paragraphContent: any[][]): JSONContent {
  return {
    type: "doc",
    content: paragraphContent.map((content) => ({
      type: "paragraph",
      content,
    })),
  };
}

function textNode(text: string) {
  return { type: "text", text };
}

function fileMention(id: string, label?: string) {
  return {
    type: "mention",
    attrs: { id, label: label ?? id, itemType: "file" },
  };
}

function otherMention(itemType: string, id = "x") {
  return { type: "mention", attrs: { id, itemType } };
}

describe("countDistinctAttachedFiles", () => {
  it("returns 0 for empty/undefined content", () => {
    expect(countDistinctAttachedFiles(undefined)).toBe(0);
    expect(countDistinctAttachedFiles(null)).toBe(0);
    expect(countDistinctAttachedFiles({ type: "doc" })).toBe(0);
  });

  it("returns 0 when there are no file mentions", () => {
    const content = doc([textNode("just plain text, no mentions")]);
    expect(countDistinctAttachedFiles(content)).toBe(0);
  });

  it("counts a single distinct file mention", () => {
    const content = doc([
      textNode("check "),
      fileMention("file:///a.ts"),
      textNode(" please"),
    ]);
    expect(countDistinctAttachedFiles(content)).toBe(1);
  });

  it("counts multiple distinct file mentions across paragraphs", () => {
    const content = doc(
      [fileMention("file:///a.ts")],
      [textNode("and "), fileMention("file:///b.ts")],
    );
    expect(countDistinctAttachedFiles(content)).toBe(2);
  });

  it("deduplicates the same file mentioned twice", () => {
    const content = doc([
      fileMention("file:///a.ts"),
      textNode(" and again "),
      fileMention("file:///a.ts"),
    ]);
    expect(countDistinctAttachedFiles(content)).toBe(1);
  });

  it("ignores non-file mentions (codebase, folder, terminal, etc.)", () => {
    const content = doc([
      otherMention("contextProvider", "codebase"),
      otherMention("folder", "file:///src"),
      textNode(" ok"),
    ]);
    expect(countDistinctAttachedFiles(content)).toBe(0);
  });

  it("only counts file mentions among a mix of mention types", () => {
    const content = doc([
      fileMention("file:///a.ts"),
      otherMention("contextProvider", "codebase"),
      fileMention("file:///b.ts"),
    ]);
    expect(countDistinctAttachedFiles(content)).toBe(2);
  });
});

describe("getMessageTextLength", () => {
  it("returns 0 for empty/undefined content", () => {
    expect(getMessageTextLength(undefined)).toBe(0);
    expect(getMessageTextLength(null)).toBe(0);
    expect(getMessageTextLength({ type: "doc" })).toBe(0);
  });

  it("measures plain text length", () => {
    const content = doc([textNode("hello world")]);
    expect(getMessageTextLength(content)).toBe(11);
  });

  it("counts a mention's rendered label toward the length", () => {
    const content = doc([
      textNode("check "),
      fileMention("file:///a.ts", "a.ts"),
    ]);
    // "check " (6, trimmed to "check" + implicit join) + "a.ts" (4)
    expect(getMessageTextLength(content)).toBe("check a.ts".length);
  });

  it("trims leading/trailing whitespace", () => {
    const content = doc([textNode("   padded   ")]);
    expect(getMessageTextLength(content)).toBe("padded".length);
  });

  it("sums text across multiple paragraphs", () => {
    const content = doc([textNode("line one")], [textNode("line two")]);
    expect(getMessageTextLength(content)).toBe("line oneline two".length);
  });
});
