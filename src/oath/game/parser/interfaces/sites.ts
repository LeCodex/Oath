
export const SiteName: Record<string, number> = {
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
  
  NONE: 255
};

export const SiteNameIndexes = Object.keys(SiteName)
  .reduce((prev, cur) => {
    prev[SiteName[cur]] = cur;
    prev[SiteName[cur] + 24] = cur;
    return prev;
  }, {} as Record<number, string>);