import { JSONContent } from "@tiptap/react";

/**
 * Counts distinct files attached as @-mention context in a draft message,
 * without resolving them (no IDE round-trip) - safe to call on every
 * keystroke. Mirrors the paragraph/mention walk in
 * TipTapEditor/utils/processEditorContent.ts, but keeps the mention's `id`
 * (file identity) instead of discarding it, since that file is only
 * interested in the provider type, not distinguishing which file is which.
 */
export function countDistinctAttachedFiles(
  editorState: JSONContent | null | undefined,
): number {
  if (!editorState?.content) {
    return 0;
  }

  const fileIds = new Set<string>();

  for (const block of editorState.content) {
    if (!block.content) {
      continue;
    }
    for (const child of block.content) {
      if (
        child.type === "mention" &&
        child.attrs?.itemType === "file" &&
        typeof child.attrs?.id === "string"
      ) {
        fileIds.add(child.attrs.id);
      }
    }
  }

  return fileIds.size;
}

/**
 * Plain-text length of a draft message's JSON content (mention nodes count
 * as their rendered label, matching what the user visually sees), without
 * needing a live editor instance - safe to call on the editorState snapshot
 * passed into the send handler.
 */
export function getMessageTextLength(
  editorState: JSONContent | null | undefined,
): number {
  if (!editorState?.content) {
    return 0;
  }

  let text = "";
  for (const block of editorState.content) {
    if (!block.content) {
      continue;
    }
    for (const child of block.content) {
      if (child.type === "text") {
        text += child.text ?? "";
      } else if (child.type === "mention") {
        text += child.attrs?.renderInlineAs ?? child.attrs?.label ?? "";
      }
    }
  }

  return text.trim().length;
}
