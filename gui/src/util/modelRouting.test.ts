import {
  computeAutoRoutedTier,
  SIMPLE_MESSAGE_CHAR_LIMIT,
} from "./modelRouting";

describe("computeAutoRoutedTier", () => {
  it("routes short chat messages to Everyday", () => {
    const result = computeAutoRoutedTier({
      mode: "chat",
      messageLength: 10,
      attachedFileCount: 0,
    });
    expect(result.tier).toBe("everyday");
  });

  it("routes chat messages exactly at the limit to Everyday", () => {
    const result = computeAutoRoutedTier({
      mode: "chat",
      messageLength: SIMPLE_MESSAGE_CHAR_LIMIT,
      attachedFileCount: 0,
    });
    expect(result.tier).toBe("everyday");
  });

  it("routes chat messages over the limit to Powerful", () => {
    const result = computeAutoRoutedTier({
      mode: "chat",
      messageLength: SIMPLE_MESSAGE_CHAR_LIMIT + 1,
      attachedFileCount: 0,
    });
    expect(result.tier).toBe("powerful");
  });

  it("routes agent mode to Powerful regardless of message length", () => {
    const result = computeAutoRoutedTier({
      mode: "agent",
      messageLength: 5,
      attachedFileCount: 0,
    });
    expect(result.tier).toBe("powerful");
  });

  it("routes plan mode to Powerful", () => {
    expect(
      computeAutoRoutedTier({
        mode: "plan",
        messageLength: 1,
        attachedFileCount: 0,
      }).tier,
    ).toBe("powerful");
  });

  it("routes background mode to Powerful", () => {
    expect(
      computeAutoRoutedTier({
        mode: "background",
        messageLength: 1,
        attachedFileCount: 0,
      }).tier,
    ).toBe("powerful");
  });

  it("routes a short chat message with 2+ attached files to Powerful (multi-file edit)", () => {
    const result = computeAutoRoutedTier({
      mode: "chat",
      messageLength: 5,
      attachedFileCount: 2,
    });
    expect(result.tier).toBe("powerful");
  });

  it("does not treat a single attached file as a multi-file edit", () => {
    const result = computeAutoRoutedTier({
      mode: "chat",
      messageLength: 5,
      attachedFileCount: 1,
    });
    expect(result.tier).toBe("everyday");
  });

  it("multi-file edit overrides even a message that would otherwise be short", () => {
    const result = computeAutoRoutedTier({
      mode: "chat",
      messageLength: 1,
      attachedFileCount: 3,
    });
    expect(result.tier).toBe("powerful");
    expect(result.reason).toMatch(/multi-file/i);
  });

  it("agent mode wins over multi-file and length signals (all point to Powerful anyway)", () => {
    const result = computeAutoRoutedTier({
      mode: "agent",
      messageLength: 1,
      attachedFileCount: 0,
    });
    expect(result.tier).toBe("powerful");
    expect(result.reason).toMatch(/agent/i);
  });
});
