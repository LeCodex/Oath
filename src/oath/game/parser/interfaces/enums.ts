import { PlayerColor } from "../../enums";

export enum Suit {
  Discord = 0,
  Hearth = 1,
  Nomad = 2,
  Arcane = 3,
  Order = 4,
  Beast = 5
}

export enum Citizenship {
  Exile = 'Exile',
  Citizen = 'Citizen'
}

export type PlayerCitizenship = Omit<
  Record<PlayerColor, Citizenship>,
  PlayerColor.Purple
>;
