import { v4 as uuidv4 } from "uuid";
import type { IGridRowItem, ILayoutConfig } from "@/types/collection";

// ─── Types ────────────────────────────────────────────────────────────────────

type FieldType = "text" | "number" | "checkbox" | "dropdown" | "textarea" | "tags" | "image" | "date";
type DropdownOption = { long: string; short: string };

export type TemplateFieldDef = {
  templateId: string;
  short: string;
  long: string;
  type: FieldType;
  options?: DropdownOption[];
  showInHeader?: boolean;
  showAsBold?: boolean;
  isActive?: boolean;
  isPublic?: boolean;
  useAsFilter?: boolean;
  useInGrid?: boolean;
  persistValue?: boolean;
  displayAs?: "long" | "short";
  orientation?: "landscape" | "portrait" | "square";
};

type TemplateGridRowDef = {
  kind: "field";
  templateId: string;
  desktopSpan: number;
  mobileSpan: number;
};

export type CollectionTemplate = {
  id: string;
  name: string;
  emoji: string;
  description: string;
  fields: TemplateFieldDef[];
  gridRows: TemplateGridRowDef[];
  layoutConfig: Partial<ILayoutConfig>;
};

export type AppliedTemplate = {
  fields: Array<TemplateFieldDef & { _id: string }>;
  gridRows: IGridRowItem[];
  layoutConfig: Partial<ILayoutConfig>;
};

export function applyTemplate(template: CollectionTemplate): AppliedTemplate {
  const idMap: Record<string, string> = {};
  template.fields.forEach((f) => { idMap[f.templateId] = uuidv4(); });

  const fields = template.fields.map((f) => ({
    ...f,
    _id: idMap[f.templateId],
    showInHeader: f.showInHeader ?? true,
    showAsBold: f.showAsBold ?? false,
    isActive: f.isActive ?? true,
    isPublic: f.isPublic ?? true,
    useAsFilter: f.useAsFilter ?? true,
    useInGrid: f.useInGrid ?? true,
    persistValue: f.persistValue ?? false,
    displayAs: f.displayAs ?? "long",
    orientation: f.orientation ?? "landscape",
    options: f.options ?? [],
  }));

  const gridRows: IGridRowItem[] = template.gridRows
    .filter((r) => idMap[r.templateId])
    .map((r) => ({
      kind: "field" as const,
      fieldId: idMap[r.templateId],
      desktopSpan: r.desktopSpan,
      mobileSpan: r.mobileSpan,
    }));

  return { fields, gridRows, layoutConfig: template.layoutConfig };
}

// ─── Shared option sets ───────────────────────────────────────────────────────

const CONDITION_BASIC: DropdownOption[] = [
  { long: "New", short: "New" },
  { long: "Like New", short: "LN" },
  { long: "Very Good", short: "VG" },
  { long: "Good", short: "Good" },
  { long: "Fair", short: "Fair" },
  { long: "Poor", short: "Poor" },
];

const CONDITION_VINYL: DropdownOption[] = [
  { long: "Mint", short: "M" },
  { long: "Near Mint", short: "NM" },
  { long: "Very Good Plus", short: "VG+" },
  { long: "Very Good", short: "VG" },
  { long: "Good", short: "G" },
  { long: "Fair", short: "F" },
  { long: "Poor", short: "P" },
];

const MOVIE_GENRES: DropdownOption[] = [
  "Action", "Comedy", "Drama", "Horror", "Science Fiction", "Thriller",
  "Romance", "Documentary", "Animation", "Fantasy", "Other",
].map((g) => ({ long: g, short: g }));

const MUSIC_GENRES: DropdownOption[] = [
  "Rock", "Pop", "Jazz", "Classical", "Electronic", "Hip-Hop",
  "R&B", "Country", "Folk", "Blues", "Metal", "Punk", "Other",
].map((g) => ({ long: g, short: g }));

// ─── Templates ────────────────────────────────────────────────────────────────

const BOOKS: CollectionTemplate = {
  id: "books", name: "Books", emoji: "📚",
  description: "Track your book collection with author, genre, and reading status",
  layoutConfig: { desktop: { columns: 4, gap: 4 }, mobile: { columns: 1, gap: 4 }, itemImageOrientation: "portrait" },
  fields: [
    { templateId: "cover",  long: "Cover",          short: "Cov",    type: "image",    orientation: "portrait", showInHeader: false, useAsFilter: false, useInGrid: false },
    { templateId: "title",  long: "Title",          short: "Title",  type: "text",     showAsBold: true },
    { templateId: "author", long: "Author",         short: "Author", type: "text" },
    { templateId: "year",   long: "Year Published", short: "Year",   type: "number",   useAsFilter: false },
    { templateId: "genre",  long: "Genre",          short: "Genre",  type: "dropdown", options: [
      "Fiction","Non-Fiction","Science Fiction","Fantasy","Mystery","Biography",
      "History","Self-Help","Children's","Thriller","Other",
    ].map(g => ({ long: g, short: g })) },
    { templateId: "isbn",   long: "ISBN",           short: "ISBN",   type: "text",     showInHeader: false, useAsFilter: false },
    { templateId: "cond",   long: "Condition",      short: "Cond",   type: "dropdown", options: CONDITION_BASIC, persistValue: true },
    { templateId: "read",   long: "Read",           short: "Read",   type: "checkbox", useAsFilter: true },
    { templateId: "notes",  long: "Notes",          short: "Notes",  type: "textarea", showInHeader: false, useAsFilter: false, useInGrid: false },
  ],
  gridRows: [
    { kind: "field", templateId: "title",  desktopSpan: 8, mobileSpan: 12 },
    { kind: "field", templateId: "author", desktopSpan: 6, mobileSpan: 8 },
    { kind: "field", templateId: "year",   desktopSpan: 3, mobileSpan: 4 },
    { kind: "field", templateId: "genre",  desktopSpan: 4, mobileSpan: 6 },
    { kind: "field", templateId: "cond",   desktopSpan: 4, mobileSpan: 6 },
    { kind: "field", templateId: "read",   desktopSpan: 4, mobileSpan: 6 },
  ],
};

const DVDS: CollectionTemplate = {
  id: "dvds", name: "DVDs", emoji: "📀",
  description: "Catalogue your DVD movies and TV series",
  layoutConfig: { desktop: { columns: 4, gap: 4 }, mobile: { columns: 1, gap: 4 }, itemImageOrientation: "portrait" },
  fields: [
    { templateId: "cover",    long: "Cover Art",     short: "Art",    type: "image",    orientation: "portrait", showInHeader: false, useAsFilter: false, useInGrid: false },
    { templateId: "title",    long: "Title",         short: "Title",  type: "text",     showAsBold: true },
    { templateId: "director", long: "Director",      short: "Dir",    type: "text" },
    { templateId: "year",     long: "Release Year",  short: "Year",   type: "number",   useAsFilter: false },
    { templateId: "genre",    long: "Genre",         short: "Genre",  type: "dropdown", options: MOVIE_GENRES },
    { templateId: "format",   long: "Format",        short: "Fmt",    type: "dropdown", options: [
      { long: "DVD", short: "DVD" }, { long: "DVD-R", short: "DVD-R" }, { long: "DVD+R", short: "DVD+R" },
    ]},
    { templateId: "region",   long: "Region",        short: "Reg",    type: "dropdown", options: [
      { long: "Region 0 (All)", short: "R0" }, { long: "Region 1 (US/CA)", short: "R1" },
      { long: "Region 2 (EU/JP)", short: "R2" }, { long: "Region 3 (SE Asia)", short: "R3" },
      { long: "Region 4 (AU/SA)", short: "R4" }, { long: "Region 5 (RU/AF)", short: "R5" },
      { long: "Region 6 (CN)", short: "R6" },
    ]},
    { templateId: "cond",     long: "Condition",     short: "Cond",   type: "dropdown", options: CONDITION_BASIC, persistValue: true },
    { templateId: "sealed",   long: "Sealed",        short: "Sealed", type: "checkbox" },
  ],
  gridRows: [
    { kind: "field", templateId: "title",    desktopSpan: 8, mobileSpan: 12 },
    { kind: "field", templateId: "director", desktopSpan: 6, mobileSpan: 8 },
    { kind: "field", templateId: "year",     desktopSpan: 3, mobileSpan: 4 },
    { kind: "field", templateId: "genre",    desktopSpan: 4, mobileSpan: 6 },
    { kind: "field", templateId: "region",   desktopSpan: 4, mobileSpan: 6 },
    { kind: "field", templateId: "cond",     desktopSpan: 4, mobileSpan: 6 },
  ],
};

const BLURAY: CollectionTemplate = {
  id: "bluray", name: "Blu-ray", emoji: "💿",
  description: "Track your Blu-ray and 4K UHD disc collection",
  layoutConfig: { desktop: { columns: 4, gap: 4 }, mobile: { columns: 1, gap: 4 }, itemImageOrientation: "portrait" },
  fields: [
    { templateId: "cover",    long: "Cover Art",     short: "Art",    type: "image",    orientation: "portrait", showInHeader: false, useAsFilter: false, useInGrid: false },
    { templateId: "title",    long: "Title",         short: "Title",  type: "text",     showAsBold: true },
    { templateId: "director", long: "Director",      short: "Dir",    type: "text" },
    { templateId: "year",     long: "Release Year",  short: "Year",   type: "number",   useAsFilter: false },
    { templateId: "genre",    long: "Genre",         short: "Genre",  type: "dropdown", options: MOVIE_GENRES },
    { templateId: "format",   long: "Format",        short: "Fmt",    type: "dropdown", options: [
      { long: "Blu-ray", short: "BD" }, { long: "4K UHD", short: "4K" },
      { long: "3D Blu-ray", short: "3D" }, { long: "Blu-ray + 4K", short: "BD+4K" },
    ]},
    { templateId: "region",   long: "Region",        short: "Reg",    type: "dropdown", options: [
      { long: "Region A (Americas / SE Asia)", short: "A" },
      { long: "Region B (Europe / Africa)", short: "B" },
      { long: "Region C (Asia)", short: "C" },
      { long: "All Regions", short: "All" },
    ]},
    { templateId: "hdr",      long: "HDR Format",    short: "HDR",    type: "dropdown", options: [
      { long: "None", short: "—" }, { long: "HDR10", short: "HDR10" },
      { long: "Dolby Vision", short: "DV" }, { long: "HDR10+", short: "HDR10+" }, { long: "HLG", short: "HLG" },
    ]},
    { templateId: "cond",     long: "Condition",     short: "Cond",   type: "dropdown", options: CONDITION_BASIC, persistValue: true },
    { templateId: "sealed",   long: "Sealed",        short: "Sealed", type: "checkbox" },
  ],
  gridRows: [
    { kind: "field", templateId: "title",    desktopSpan: 8, mobileSpan: 12 },
    { kind: "field", templateId: "director", desktopSpan: 6, mobileSpan: 8 },
    { kind: "field", templateId: "year",     desktopSpan: 3, mobileSpan: 4 },
    { kind: "field", templateId: "format",   desktopSpan: 4, mobileSpan: 6 },
    { kind: "field", templateId: "hdr",      desktopSpan: 4, mobileSpan: 6 },
    { kind: "field", templateId: "region",   desktopSpan: 4, mobileSpan: 6 },
    { kind: "field", templateId: "cond",     desktopSpan: 4, mobileSpan: 6 },
  ],
};

const VINYL: CollectionTemplate = {
  id: "vinyl", name: "Vinyl Records", emoji: "🎵",
  description: "Organise your vinyl record collection by artist, label, and pressing",
  layoutConfig: { desktop: { columns: 4, gap: 4 }, mobile: { columns: 1, gap: 4 }, itemImageOrientation: "square" },
  fields: [
    { templateId: "cover",   long: "Album Art",     short: "Art",    type: "image",    orientation: "square", showInHeader: false, useAsFilter: false, useInGrid: false },
    { templateId: "title",   long: "Album Title",   short: "Album",  type: "text",     showAsBold: true },
    { templateId: "artist",  long: "Artist",        short: "Artist", type: "text" },
    { templateId: "label",   long: "Label",         short: "Label",  type: "text" },
    { templateId: "year",    long: "Release Year",  short: "Year",   type: "number",   useAsFilter: false },
    { templateId: "genre",   long: "Genre",         short: "Genre",  type: "dropdown", options: MUSIC_GENRES },
    { templateId: "format",  long: "Format",        short: "Fmt",    type: "dropdown", options: [
      { long: "LP (12\")", short: "LP" }, { long: "EP", short: "EP" },
      { long: "Single (7\")", short: "7\"" }, { long: "10\"", short: "10\"" }, { long: "12\" Single", short: "12\"" },
    ]},
    { templateId: "speed",   long: "Speed",         short: "RPM",    type: "dropdown", options: [
      { long: "33⅓ RPM", short: "33" }, { long: "45 RPM", short: "45" }, { long: "78 RPM", short: "78" },
    ]},
    { templateId: "color",   long: "Vinyl Color",   short: "Color",  type: "text",     useAsFilter: false },
    { templateId: "country", long: "Country",       short: "Ctry",   type: "text" },
    { templateId: "cond",    long: "Condition",     short: "Cond",   type: "dropdown", options: CONDITION_VINYL, persistValue: true },
    { templateId: "numbered",long: "Numbered",      short: "#d",     type: "checkbox" },
  ],
  gridRows: [
    { kind: "field", templateId: "title",   desktopSpan: 8, mobileSpan: 12 },
    { kind: "field", templateId: "artist",  desktopSpan: 6, mobileSpan: 8 },
    { kind: "field", templateId: "label",   desktopSpan: 4, mobileSpan: 7 },
    { kind: "field", templateId: "year",    desktopSpan: 2, mobileSpan: 5 },
    { kind: "field", templateId: "genre",   desktopSpan: 4, mobileSpan: 6 },
    { kind: "field", templateId: "format",  desktopSpan: 4, mobileSpan: 6 },
    { kind: "field", templateId: "cond",    desktopSpan: 4, mobileSpan: 6 },
  ],
};

const CDS: CollectionTemplate = {
  id: "cds", name: "CDs", emoji: "💽",
  description: "Catalogue your CD collection with artist, label, and catalogue number",
  layoutConfig: { desktop: { columns: 4, gap: 4 }, mobile: { columns: 1, gap: 4 }, itemImageOrientation: "square" },
  fields: [
    { templateId: "cover",     long: "Album Art",     short: "Art",   type: "image",    orientation: "square", showInHeader: false, useAsFilter: false, useInGrid: false },
    { templateId: "title",     long: "Album Title",   short: "Album", type: "text",     showAsBold: true },
    { templateId: "artist",    long: "Artist",        short: "Artist",type: "text" },
    { templateId: "label",     long: "Label",         short: "Label", type: "text" },
    { templateId: "year",      long: "Release Year",  short: "Year",  type: "number",   useAsFilter: false },
    { templateId: "catalogue", long: "Catalogue #",   short: "Cat#",  type: "text",     useAsFilter: false },
    { templateId: "genre",     long: "Genre",         short: "Genre", type: "dropdown", options: MUSIC_GENRES },
    { templateId: "format",    long: "Format",        short: "Fmt",   type: "dropdown", options: [
      { long: "Album", short: "LP" }, { long: "EP", short: "EP" },
      { long: "Single", short: "SG" }, { long: "Compilation", short: "Comp" }, { long: "Box Set", short: "Box" },
    ]},
    { templateId: "cond",      long: "Condition",     short: "Cond",  type: "dropdown", options: CONDITION_BASIC, persistValue: true },
    { templateId: "sealed",    long: "Sealed",        short: "Sealed",type: "checkbox" },
  ],
  gridRows: [
    { kind: "field", templateId: "title",     desktopSpan: 8, mobileSpan: 12 },
    { kind: "field", templateId: "artist",    desktopSpan: 6, mobileSpan: 8 },
    { kind: "field", templateId: "label",     desktopSpan: 4, mobileSpan: 7 },
    { kind: "field", templateId: "year",      desktopSpan: 2, mobileSpan: 5 },
    { kind: "field", templateId: "genre",     desktopSpan: 4, mobileSpan: 6 },
    { kind: "field", templateId: "catalogue", desktopSpan: 4, mobileSpan: 6 },
    { kind: "field", templateId: "cond",      desktopSpan: 4, mobileSpan: 6 },
  ],
};

const VIDEOGAMES: CollectionTemplate = {
  id: "videogames", name: "Video Games", emoji: "🎮",
  description: "Track your game library with platform, genre, and completion status",
  layoutConfig: { desktop: { columns: 4, gap: 4 }, mobile: { columns: 1, gap: 4 }, itemImageOrientation: "portrait" },
  fields: [
    { templateId: "cover",     long: "Box Art",       short: "Art",    type: "image",    orientation: "portrait", showInHeader: false, useAsFilter: false, useInGrid: false },
    { templateId: "title",     long: "Title",         short: "Title",  type: "text",     showAsBold: true },
    { templateId: "platform",  long: "Platform",      short: "Plat",   type: "dropdown", options: [
      "PlayStation 5","PlayStation 4","PlayStation 3","PlayStation 2","PlayStation 1",
      "Xbox Series X/S","Xbox One","Xbox 360","Xbox",
      "Nintendo Switch","Nintendo 3DS","Nintendo DS","Game Boy Advance","Game Boy Color","Game Boy",
      "Wii U","Wii","GameCube","Nintendo 64","SNES","NES",
      "Sega Mega Drive","Sega Saturn","Dreamcast","PC","Other",
    ].map(p => ({ long: p, short: p }))},
    { templateId: "genre",     long: "Genre",         short: "Genre",  type: "dropdown", options: [
      "Action","Adventure","RPG","Strategy","Puzzle","Sports","Racing","Shooter","Fighting","Simulation","Horror","Other",
    ].map(g => ({ long: g, short: g }))},
    { templateId: "year",      long: "Release Year",  short: "Year",   type: "number",   useAsFilter: false },
    { templateId: "developer", long: "Developer",     short: "Dev",    type: "text",     showInHeader: false },
    { templateId: "cond",      long: "Condition",     short: "Cond",   type: "dropdown", options: [
      { long: "Complete In Box", short: "CIB" }, { long: "Loose (cartridge/disc only)", short: "Loose" },
      { long: "Sealed", short: "Sealed" }, { long: "Box Only", short: "Box" }, { long: "Manual Only", short: "Man" },
    ], persistValue: true},
    { templateId: "completed", long: "Completed",     short: "Done",   type: "checkbox" },
    { templateId: "notes",     long: "Notes",         short: "Notes",  type: "textarea", showInHeader: false, useAsFilter: false, useInGrid: false },
  ],
  gridRows: [
    { kind: "field", templateId: "title",     desktopSpan: 8, mobileSpan: 12 },
    { kind: "field", templateId: "platform",  desktopSpan: 6, mobileSpan: 8 },
    { kind: "field", templateId: "genre",     desktopSpan: 4, mobileSpan: 6 },
    { kind: "field", templateId: "year",      desktopSpan: 2, mobileSpan: 6 },
    { kind: "field", templateId: "cond",      desktopSpan: 6, mobileSpan: 8 },
    { kind: "field", templateId: "completed", desktopSpan: 3, mobileSpan: 4 },
  ],
};

const LEGO: CollectionTemplate = {
  id: "lego", name: "Lego", emoji: "🧱",
  description: "Catalogue your Lego sets with theme, piece count, and build status",
  layoutConfig: { desktop: { columns: 4, gap: 4 }, mobile: { columns: 1, gap: 4 }, itemImageOrientation: "landscape" },
  fields: [
    { templateId: "photo",      long: "Photo",         short: "Photo",  type: "image",    orientation: "landscape", showInHeader: false, useAsFilter: false, useInGrid: false },
    { templateId: "name",       long: "Set Name",      short: "Name",   type: "text",     showAsBold: true },
    { templateId: "set_number", long: "Set Number",    short: "Set#",   type: "text" },
    { templateId: "theme",      long: "Theme",         short: "Theme",  type: "dropdown", options: [
      "Star Wars","Technic","City","Harry Potter","Creator Expert","Architecture",
      "Icons","Ideas","Minecraft","DC","Marvel","Jurassic World","Speed Champions",
      "Classic","Friends","NINJAGO","BrickHeadz","Art","Other",
    ].map(t => ({ long: t, short: t }))},
    { templateId: "year",       long: "Release Year",  short: "Year",   type: "number",   useAsFilter: false },
    { templateId: "pieces",     long: "Piece Count",   short: "PCs",    type: "number",   useAsFilter: false },
    { templateId: "minifigs",   long: "Minifigures",   short: "Figs",   type: "number",   useAsFilter: false },
    { templateId: "cond",       long: "Condition",     short: "Cond",   type: "dropdown", options: [
      { long: "Sealed (NIB)", short: "NIB" }, { long: "Complete (Built)", short: "Built" },
      { long: "Complete (Unbuilt)", short: "Unbuilt" }, { long: "Incomplete", short: "Inc" },
      { long: "Parts Only", short: "Parts" },
    ], persistValue: true},
    { templateId: "box",        long: "Has Box",       short: "Box",    type: "checkbox" },
    { templateId: "instr",      long: "Has Instructions", short: "Inst", type: "checkbox" },
  ],
  gridRows: [
    { kind: "field", templateId: "name",       desktopSpan: 8, mobileSpan: 12 },
    { kind: "field", templateId: "set_number", desktopSpan: 4, mobileSpan: 6 },
    { kind: "field", templateId: "theme",      desktopSpan: 5, mobileSpan: 6 },
    { kind: "field", templateId: "year",       desktopSpan: 3, mobileSpan: 4 },
    { kind: "field", templateId: "pieces",     desktopSpan: 2, mobileSpan: 4 },
    { kind: "field", templateId: "minifigs",   desktopSpan: 2, mobileSpan: 4 },
    { kind: "field", templateId: "cond",       desktopSpan: 5, mobileSpan: 8 },
  ],
};

const COINS: CollectionTemplate = {
  id: "coins", name: "Coins", emoji: "🪙",
  description: "Track your coin collection with denomination, year, and grading",
  layoutConfig: { desktop: { columns: 4, gap: 4 }, mobile: { columns: 1, gap: 4 }, itemImageOrientation: "square" },
  fields: [
    { templateId: "photo",       long: "Photo",          short: "Photo", type: "image",    orientation: "square", showInHeader: false, useAsFilter: false, useInGrid: false },
    { templateId: "name",        long: "Coin Name",      short: "Name",  type: "text",     showAsBold: true },
    { templateId: "country",     long: "Country",        short: "Ctry",  type: "text" },
    { templateId: "year",        long: "Year",           short: "Year",  type: "number" },
    { templateId: "denomination",long: "Denomination",   short: "Denom", type: "text" },
    { templateId: "mint",        long: "Mint Mark",      short: "Mint",  type: "text" },
    { templateId: "metal",       long: "Metal",          short: "Metal", type: "dropdown", options: [
      { long: "Gold", short: "Au" }, { long: "Silver", short: "Ag" }, { long: "Copper", short: "Cu" },
      { long: "Nickel", short: "Ni" }, { long: "Brass", short: "Br" }, { long: "Bronze", short: "Bz" },
      { long: "Platinum", short: "Pt" }, { long: "Zinc", short: "Zn" }, { long: "Other", short: "Oth" },
    ]},
    { templateId: "grade",       long: "Grade",          short: "Grade", type: "dropdown", options: [
      { long: "Poor (P-1)", short: "P-1" }, { long: "Fair (F-2)", short: "F-2" },
      { long: "About Good (AG-3)", short: "AG-3" }, { long: "Good (G-4/6)", short: "G" },
      { long: "Very Good (VG-8/10)", short: "VG" }, { long: "Fine (F-12/15)", short: "F" },
      { long: "Very Fine (VF-20–35)", short: "VF" }, { long: "Extremely Fine (EF-40/45)", short: "EF" },
      { long: "About Uncirculated (AU-50–58)", short: "AU" },
      { long: "Mint State (MS-60 to MS-70)", short: "MS" }, { long: "Proof (PR/PF)", short: "PR" },
    ]},
    { templateId: "certified",   long: "Certified",      short: "Cert",  type: "checkbox" },
    { templateId: "error",       long: "Error Coin",     short: "Error", type: "checkbox" },
  ],
  gridRows: [
    { kind: "field", templateId: "name",         desktopSpan: 8, mobileSpan: 12 },
    { kind: "field", templateId: "country",      desktopSpan: 5, mobileSpan: 7 },
    { kind: "field", templateId: "year",         desktopSpan: 3, mobileSpan: 5 },
    { kind: "field", templateId: "denomination", desktopSpan: 4, mobileSpan: 6 },
    { kind: "field", templateId: "metal",        desktopSpan: 4, mobileSpan: 6 },
    { kind: "field", templateId: "grade",        desktopSpan: 6, mobileSpan: 8 },
    { kind: "field", templateId: "certified",    desktopSpan: 3, mobileSpan: 4 },
  ],
};

const STAMPS: CollectionTemplate = {
  id: "stamps", name: "Stamps", emoji: "📮",
  description: "Organise your philatelic collection by country, issue, and condition",
  layoutConfig: { desktop: { columns: 4, gap: 4 }, mobile: { columns: 1, gap: 4 }, itemImageOrientation: "portrait" },
  fields: [
    { templateId: "photo",      long: "Photo",          short: "Photo", type: "image",    orientation: "portrait", showInHeader: false, useAsFilter: false, useInGrid: false },
    { templateId: "name",       long: "Stamp Name",     short: "Name",  type: "text",     showAsBold: true },
    { templateId: "country",    long: "Country",        short: "Ctry",  type: "text" },
    { templateId: "year",       long: "Year Issued",    short: "Year",  type: "number" },
    { templateId: "cat_number", long: "Catalogue #",    short: "Cat#",  type: "text",     useAsFilter: false },
    { templateId: "denom",      long: "Denomination",   short: "Denom", type: "text" },
    { templateId: "topic",      long: "Topic / Theme",  short: "Topic", type: "tags" },
    { templateId: "cond",       long: "Condition",      short: "Cond",  type: "dropdown", options: [
      { long: "Mint Never Hinged", short: "MNH" }, { long: "Mint Hinged", short: "MH" },
      { long: "Used", short: "Used" }, { long: "Cancelled To Order", short: "CTO" },
      { long: "On Cover", short: "OC" }, { long: "Faulty", short: "Faulty" },
    ], persistValue: true},
  ],
  gridRows: [
    { kind: "field", templateId: "name",       desktopSpan: 8, mobileSpan: 12 },
    { kind: "field", templateId: "country",    desktopSpan: 6, mobileSpan: 7 },
    { kind: "field", templateId: "year",       desktopSpan: 3, mobileSpan: 5 },
    { kind: "field", templateId: "denom",      desktopSpan: 3, mobileSpan: 6 },
    { kind: "field", templateId: "cat_number", desktopSpan: 3, mobileSpan: 6 },
    { kind: "field", templateId: "cond",       desktopSpan: 4, mobileSpan: 8 },
    { kind: "field", templateId: "topic",      desktopSpan: 8, mobileSpan: 12 },
  ],
};

const COMICS: CollectionTemplate = {
  id: "comics", name: "Comics", emoji: "💬",
  description: "Track your comic book collection with issue number, publisher, and grading",
  layoutConfig: { desktop: { columns: 4, gap: 4 }, mobile: { columns: 1, gap: 4 }, itemImageOrientation: "portrait" },
  fields: [
    { templateId: "cover",       long: "Cover",          short: "Cover",  type: "image",    orientation: "portrait", showInHeader: false, useAsFilter: false, useInGrid: false },
    { templateId: "title",       long: "Series Title",   short: "Title",  type: "text",     showAsBold: true },
    { templateId: "issue",       long: "Issue #",        short: "Iss#",   type: "number" },
    { templateId: "publisher",   long: "Publisher",      short: "Pub",    type: "dropdown", options: [
      "Marvel","DC Comics","Image Comics","Dark Horse","IDW Publishing",
      "BOOM! Studios","Vertigo","Fantagraphics","Other",
    ].map(p => ({ long: p, short: p }))},
    { templateId: "year",        long: "Cover Year",     short: "Year",   type: "number",   useAsFilter: false },
    { templateId: "writer",      long: "Writer",         short: "Writer", type: "text",     showInHeader: false },
    { templateId: "artist",      long: "Artist",         short: "Artist", type: "text",     showInHeader: false },
    { templateId: "cond",        long: "Condition",      short: "Grade",  type: "dropdown", options: [
      { long: "Gem Mint (10.0)", short: "GM" }, { long: "Mint (9.9)", short: "MT" },
      { long: "Near Mint/Mint (9.8)", short: "NM/M" }, { long: "Near Mint+ (9.6)", short: "NM+" },
      { long: "Near Mint (9.4)", short: "NM" }, { long: "Very Fine/NM (9.0)", short: "VF/NM" },
      { long: "Very Fine (8.0)", short: "VF" }, { long: "Fine (6.0)", short: "FN" },
      { long: "Very Good (4.0)", short: "VG" }, { long: "Good (2.0)", short: "GD" },
      { long: "Fair (1.5)", short: "FR" }, { long: "Poor (0.5)", short: "PR" },
    ], persistValue: true},
    { templateId: "variant",     long: "Variant Cover",  short: "Var",    type: "checkbox" },
    { templateId: "first_app",   long: "First Appearance", short: "1st",  type: "checkbox" },
    { templateId: "read",        long: "Read",           short: "Read",   type: "checkbox" },
  ],
  gridRows: [
    { kind: "field", templateId: "title",     desktopSpan: 8, mobileSpan: 12 },
    { kind: "field", templateId: "issue",     desktopSpan: 3, mobileSpan: 5 },
    { kind: "field", templateId: "publisher", desktopSpan: 5, mobileSpan: 7 },
    { kind: "field", templateId: "year",      desktopSpan: 2, mobileSpan: 4 },
    { kind: "field", templateId: "cond",      desktopSpan: 5, mobileSpan: 8 },
    { kind: "field", templateId: "first_app", desktopSpan: 3, mobileSpan: 4 },
    { kind: "field", templateId: "variant",   desktopSpan: 3, mobileSpan: 4 },
    { kind: "field", templateId: "read",      desktopSpan: 3, mobileSpan: 4 },
  ],
};

const WATCHES: CollectionTemplate = {
  id: "watches", name: "Watches", emoji: "⌚",
  description: "Log your watch collection with movement type, reference number, and condition",
  layoutConfig: { desktop: { columns: 4, gap: 4 }, mobile: { columns: 1, gap: 4 }, itemImageOrientation: "square" },
  fields: [
    { templateId: "photo",      long: "Photo",          short: "Photo", type: "image",    orientation: "square", showInHeader: false, useAsFilter: false, useInGrid: false },
    { templateId: "brand",      long: "Brand",          short: "Brand", type: "text",     showAsBold: true },
    { templateId: "model",      long: "Model",          short: "Model", type: "text" },
    { templateId: "reference",  long: "Reference #",   short: "Ref#",  type: "text",     useAsFilter: false },
    { templateId: "year",       long: "Year",           short: "Year",  type: "number",   useAsFilter: false },
    { templateId: "movement",   long: "Movement Type",  short: "Mvmt",  type: "dropdown", options: [
      { long: "Automatic", short: "Auto" }, { long: "Manual (Hand-wind)", short: "Manual" },
      { long: "Quartz", short: "Quartz" }, { long: "Solar", short: "Solar" },
      { long: "Spring Drive", short: "SD" }, { long: "Other", short: "Oth" },
    ]},
    { templateId: "case_mat",   long: "Case Material",  short: "Case",  type: "dropdown", options: [
      { long: "Stainless Steel", short: "SS" }, { long: "Yellow Gold", short: "YG" },
      { long: "Rose Gold", short: "RG" }, { long: "White Gold", short: "WG" },
      { long: "Titanium", short: "Ti" }, { long: "Ceramic", short: "Cer" },
      { long: "Platinum", short: "Pt" }, { long: "Plastic / Resin", short: "Plastic" }, { long: "Other", short: "Oth" },
    ]},
    { templateId: "dial",       long: "Dial Color",     short: "Dial",  type: "text" },
    { templateId: "cond",       long: "Condition",      short: "Cond",  type: "dropdown", options: CONDITION_BASIC, persistValue: true },
    { templateId: "box_papers", long: "Box & Papers",   short: "B&P",   type: "dropdown", options: [
      { long: "Full Set (Box & Papers)", short: "Full" }, { long: "Box Only", short: "Box" },
      { long: "Papers Only", short: "Papers" }, { long: "No Box or Papers", short: "None" },
    ]},
    { templateId: "serial",     long: "Serial Number",  short: "SN",    type: "text",     showInHeader: false, useAsFilter: false, isPublic: false },
  ],
  gridRows: [
    { kind: "field", templateId: "brand",      desktopSpan: 5, mobileSpan: 7 },
    { kind: "field", templateId: "model",      desktopSpan: 5, mobileSpan: 7 },
    { kind: "field", templateId: "reference",  desktopSpan: 4, mobileSpan: 5 },
    { kind: "field", templateId: "year",       desktopSpan: 3, mobileSpan: 4 },
    { kind: "field", templateId: "movement",   desktopSpan: 5, mobileSpan: 7 },
    { kind: "field", templateId: "case_mat",   desktopSpan: 5, mobileSpan: 7 },
    { kind: "field", templateId: "cond",       desktopSpan: 4, mobileSpan: 6 },
    { kind: "field", templateId: "box_papers", desktopSpan: 4, mobileSpan: 6 },
  ],
};

const TRADING_CARDS: CollectionTemplate = {
  id: "tradingcards", name: "Trading Cards", emoji: "🃏",
  description: "Manage your trading card collection with set, rarity, and condition",
  layoutConfig: { desktop: { columns: 4, gap: 4 }, mobile: { columns: 1, gap: 4 }, itemImageOrientation: "portrait" },
  fields: [
    { templateId: "photo",      long: "Card Photo",     short: "Photo",  type: "image",    orientation: "portrait", showInHeader: false, useAsFilter: false, useInGrid: false },
    { templateId: "name",       long: "Card Name",      short: "Name",   type: "text",     showAsBold: true },
    { templateId: "game",       long: "Game / Brand",   short: "Game",   type: "dropdown", options: [
      "Pokémon","Magic: The Gathering","Yu-Gi-Oh!","One Piece TCG",
      "Dragon Ball Super","Flesh and Blood","Disney Lorcana","Sports Cards","Other",
    ].map(g => ({ long: g, short: g }))},
    { templateId: "set",        long: "Set Name",       short: "Set",    type: "text" },
    { templateId: "card_num",   long: "Card Number",    short: "Card#",  type: "text",     useAsFilter: false },
    { templateId: "year",       long: "Year",           short: "Year",   type: "number",   useAsFilter: false },
    { templateId: "rarity",     long: "Rarity",         short: "Rarity", type: "dropdown", options: [
      { long: "Common", short: "C" }, { long: "Uncommon", short: "U" }, { long: "Rare", short: "R" },
      { long: "Holo Rare", short: "HR" }, { long: "Ultra Rare", short: "UR" }, { long: "Secret Rare", short: "SR" },
      { long: "Full Art", short: "FA" }, { long: "Alternate Art", short: "AA" }, { long: "Promo", short: "PR" }, { long: "Other", short: "Oth" },
    ]},
    { templateId: "cond",       long: "Condition",      short: "Cond",   type: "dropdown", options: [
      { long: "Gem Mint (10)", short: "10" }, { long: "Mint (9)", short: "9" },
      { long: "NM-MT (8)", short: "8" }, { long: "Near Mint (7)", short: "7" },
      { long: "EX-MT (6)", short: "6" }, { long: "Excellent (5)", short: "5" },
      { long: "VG-EX (4)", short: "4" }, { long: "Very Good (3)", short: "3" },
      { long: "Good (2)", short: "2" }, { long: "Poor (1)", short: "1" },
    ], persistValue: true},
    { templateId: "foil",       long: "Foil / Holo",    short: "Foil",   type: "checkbox" },
    { templateId: "quantity",   long: "Quantity",       short: "Qty",    type: "number",   persistValue: true, useAsFilter: false },
  ],
  gridRows: [
    { kind: "field", templateId: "name",     desktopSpan: 8, mobileSpan: 12 },
    { kind: "field", templateId: "game",     desktopSpan: 5, mobileSpan: 7 },
    { kind: "field", templateId: "set",      desktopSpan: 5, mobileSpan: 7 },
    { kind: "field", templateId: "rarity",   desktopSpan: 4, mobileSpan: 6 },
    { kind: "field", templateId: "cond",     desktopSpan: 4, mobileSpan: 6 },
    { kind: "field", templateId: "foil",     desktopSpan: 2, mobileSpan: 4 },
    { kind: "field", templateId: "quantity", desktopSpan: 2, mobileSpan: 4 },
  ],
};

// ─── Exports ──────────────────────────────────────────────────────────────────

export const COLLECTION_TEMPLATES: CollectionTemplate[] = [
  BOOKS, DVDS, BLURAY, VINYL, CDS, VIDEOGAMES,
  LEGO, COINS, STAMPS, COMICS, WATCHES, TRADING_CARDS,
];
