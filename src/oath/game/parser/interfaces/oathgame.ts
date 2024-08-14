import { PlayerColor, OathSuit, OathType } from '../../enums';
import { PlayerCitizenship } from './enums';

export interface CardData {
  name: string;
}

export interface SiteData {
  name: string;
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
