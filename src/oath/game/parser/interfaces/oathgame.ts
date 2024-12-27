import { PlayerColor, OathSuit, OathType } from '../../enums';
import { CardName } from './cards';
import { PlayerCitizenship } from './enums';
import { SiteName } from './sites';

export interface CardData {
  name: keyof typeof CardName;
}

export interface SiteData {
  name: keyof typeof SiteName;
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
