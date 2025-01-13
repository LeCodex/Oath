
export const SiteName = {
  Mine: 0,
  SaltFlats: 1,
  FertileValley: 2,
  BarrenCoast: 3,
  Plains: 4,
  River: 5,
  Steppe: 6,
  Mountain: 7,
  LushCoast: 8,
  Marshes: 9,
  Wastes: 10,
  RockyCoast: 11,
  NarrowPass: 12,
  CharmingValley: 13,
  DeepWoods: 14,
  StandingStones: 15,
  AncientCity: 16,
  DrownedCity: 17,
  GreatSlum: 18,
  BuriedGiant: 19,
  TheTribunal: 20,
  ShroudedWood: 21,
  TheHiddenPlace: 22,
} as const;

export const CompleteSiteName = {
  ...SiteName,
  
  NONE: 255
} as const;

export const SiteNameIndexes = Object.keys(CompleteSiteName)
  .reduce((prev, cur: keyof typeof CompleteSiteName) => {
    prev[CompleteSiteName[cur]!] = cur;
    prev[CompleteSiteName[cur]! + 24] = cur;
    return prev;
  }, {} as Record<number, keyof typeof CompleteSiteName>);