import { ContextItemWithId } from "core";
import { getContextItemKey } from "./contextItemKey";

function item(overrides: Partial<ContextItemWithId> = {}): ContextItemWithId {
  return {
    content: "some content",
    name: "foo.ts",
    description: "src/foo.ts",
    id: { providerTitle: "file", itemId: "random-uuid-1" },
    ...overrides,
  };
}

describe("getContextItemKey", () => {
  it("keys file items by uri, ignoring the volatile itemId", () => {
    const a = item({
      id: { providerTitle: "file", itemId: "uuid-a" },
      uri: { type: "file", value: "file:///a.ts" },
    });
    const b = item({
      id: { providerTitle: "file", itemId: "uuid-b" },
      uri: { type: "file", value: "file:///a.ts" },
    });
    expect(getContextItemKey(a)).toBe(getContextItemKey(b));
  });

  it("produces different keys for different uris", () => {
    const a = item({ uri: { type: "file", value: "file:///a.ts" } });
    const b = item({ uri: { type: "file", value: "file:///b.ts" } });
    expect(getContextItemKey(a)).not.toBe(getContextItemKey(b));
  });

  it("falls back to provider+name+description when there's no uri", () => {
    const a = item({
      id: { providerTitle: "codebase", itemId: "uuid-a" },
      uri: undefined,
      description: "chunk 1",
    });
    const b = item({
      id: { providerTitle: "codebase", itemId: "uuid-b" },
      uri: undefined,
      description: "chunk 1",
    });
    expect(getContextItemKey(a)).toBe(getContextItemKey(b));
  });

  it("doesn't collide two different uri-less items that share a (or both lack a) description", () => {
    // Regression: the fallback key used to be provider+description alone, so
    // two distinct items from the same provider with an identical or both-
    // undefined description hashed to the same key - excluding one silently
    // excluded the other too.
    const a = item({
      id: { providerTitle: "terminal", itemId: "uuid-a" },
      uri: undefined,
      name: "Terminal 1",
      description: "",
    });
    const b = item({
      id: { providerTitle: "terminal", itemId: "uuid-b" },
      uri: undefined,
      name: "Terminal 2",
      description: "",
    });
    expect(getContextItemKey(a)).not.toBe(getContextItemKey(b));
  });
});
