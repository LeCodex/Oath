import { PlayerColor, OathSuit, OathType } from '../../enums';
import { PlayerCitizenship } from './enums';

export interface Card {
  name: string;
}

export interface Site {
  name: string;
  facedown: boolean;
  cards: Card[];
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
  sites: Site[];
  world: Card[];
  dispossessed: Card[];
  relics: Card[];

  prevPlayerCitizenship: PlayerCitizenship;
  winner: PlayerColor;
}
