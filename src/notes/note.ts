import { Note } from "../types/core.js";
import { randomField } from "../utils/crypto.js";

export function buildNote(params: Omit<Note, "randomness">): Note {
  return { ...params, randomness: { r: randomField() } };
}
