import type { Calendar, OwningUnitTreeNode } from '../../types';

/**
 * Plain helper functions (date picker, unit-path helpers) cannot use React context. This holds the latest organisation chart and
 * calendars that the DirectoryProvider read from the backend so those helpers see the same data as the screens - not a copy kept
 * in the browser's storage.
 */
let unitTree: OwningUnitTreeNode[] = [];
let calendars: Calendar[] = [];

export function setRuntimeDirectory(next: { unitNodes: OwningUnitTreeNode[]; calendars: Calendar[] }): void {
  unitTree = next.unitNodes;
  calendars = next.calendars;
}

export const getRuntimeUnitTree = (): OwningUnitTreeNode[] => unitTree;
export const getRuntimeCalendars = (): Calendar[] => calendars;
