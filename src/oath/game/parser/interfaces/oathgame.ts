import type { PlayerColor, OathSuit, OathType } from '../../enums';
import type { CardName } from './cards';
import type { PlayerCitizenship } from './enums';
import type { CompleteSiteName } from './sites';

export interface CardData {
  name: keyof typeof CardName;
}

export interface SiteData {
  name: keyof typeof CompleteSiteName;
  facedown: boolean;
  cards: CardData[];
}

export interface OathGameData {
  version: {
    major: string
    minor: string
    patch: string
  }

  gameCount: number;
  chronicleName: string;

  playerCitizenship: PlayerCitizenship;
  oath: OathType;
  suitOrder: OathSuit[];
  sites: SiteData[];
  world: CardData[];
  dispossessed: CardData[];
  relics: CardData[];

  prevPlayerCitizenship: PlayerCitizenship;
  winner: PlayerColor;
}
