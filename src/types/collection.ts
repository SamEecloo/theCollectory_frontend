export interface IGridField {
  fieldId: string;
  desktopSpan: number;   // 1-12
  mobileSpan: number;    // 1-12
}

export interface IGridGroup {
  id: string;            // unique group id
  desktopSpan: number;   // outer group span (1-12)
  mobileSpan: number;    // outer group span (1-12)
  fields: IGridField[];  // fields inside the group
}

// A row item is either a standalone field OR a group
export type IGridRowItem =
  | { kind: 'field'; fieldId: string; desktopSpan: number; mobileSpan: number }
  | { kind: 'group'; id: string; desktopSpan: number; mobileSpan: number; fields: IGridField[] };

export interface ILayoutConfig {
  desktop: {
    columns: 2 | 3 | 4 | 5 | 6;
    gap: 2 | 4 | 6 | 8;
  };
  mobile: {
    columns: 1 | 2;
    gap: 2 | 4;
  };
  itemImageOrientation: 'landscape' | 'portrait' | 'square';
  gridRows: IGridRowItem[];  // ← replaces gridFields
}

export const DEFAULT_LAYOUT: ILayoutConfig = {
  desktop: { columns: 4, gap: 4 },
  mobile: { columns: 1, gap: 4 },
  itemImageOrientation: 'landscape',
  gridRows: [],
};