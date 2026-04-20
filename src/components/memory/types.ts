export type MemoryGraphFocusKind = 'root' | 'type' | 'theme' | 'entry';

export interface MemoryGraphFocus {
  id: string;
  kind: MemoryGraphFocusKind;
  label: string;
  summary: string;
  count: number;
  entryNames: string[];
}
