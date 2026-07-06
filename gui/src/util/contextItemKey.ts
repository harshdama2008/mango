import { ContextItemWithId } from "core";

/**
 * A stable identity key for a context item, usable across separate
 * resolutions of "the same" item. core assigns a fresh random itemId on
 * every context/getContextItems call (core/core.ts), so item.id.itemId
 * can't be used to recognize an item the user previously excluded - this
 * keys off the file uri (or provider+description as a fallback) instead,
 * mirroring the dedup key already used in gatherContextItems.
 */
export function getContextItemKey(item: ContextItemWithId): string {
  if (item.uri?.value) {
    return `uri:${item.uri.type}:${item.uri.value}`;
  }
  // Include name as well as description - two items from the same provider
  // can easily share an (or both lack a) description, and colliding onto the
  // same key means excluding one silently excludes the other too.
  return `id:${item.id.providerTitle}:${item.name}:${item.description}`;
}
