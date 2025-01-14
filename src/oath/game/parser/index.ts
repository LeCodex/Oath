
/** Oath TTS Seed parser by seiyria: https://github.com/Vagabottos/OathParser 
 *  Adapted to fit into the rest of the system
*/
import { OathType, PlayerColor } from '../enums';
import type {
  CardData,
  OathGameData,
  PlayerCitizenship} from './interfaces';
import {
  CardName,
  CardNameIndexes,
  Citizenship,
  CompleteSiteName,
  SiteNameIndexes,
} from './interfaces';

const CHRONICLE_NAME_MIN_LENGTH = 1;
const CHRONICLE_NAME_MAX_LENGTH = 255;

enum SavefileDataType {
  VersionMajor,
  VersionMinor,
  VersionPatch,
  GameCount,
  ChronicleNameLength,
  PlayerStatus,
  ExileCitizenStatus,
  OathType,
  SuitOrder,
  Site1,
  Site2,
  Site3,
  Site4,
  Site5,
  Site6,
  Site7,
  Site8,
  WorldDeckSize,
  DispossessedDeckSize,
  RelicDeckSize,
  ExileCitizenStatusPrev,
  WinningColor
}

const Indices: Record<SavefileDataType, (offset: number) => ({ start: number, end: number })> = {
  [SavefileDataType.VersionMajor]:            (offset: number) => ({ start: 0,            end: 2 }),
  [SavefileDataType.VersionMinor]:            (offset: number) => ({ start: 2,            end: 4 }),
  [SavefileDataType.VersionPatch]:            (offset: number) => ({ start: 4,            end: 6 }),
  [SavefileDataType.GameCount]:               (offset: number) => ({ start: 6,            end: 10 }),
  [SavefileDataType.ChronicleNameLength]:     (offset: number) => ({ start: 10,           end: 12 }),

  // offset dynamically set to chronicle name length between these places

  [SavefileDataType.PlayerStatus]:            (offset: number) => ({ start: offset + 0,   end: offset + 2 }),

  [SavefileDataType.ExileCitizenStatus]:      (offset: number) => ({ start: offset + 2,   end: offset + 4 }),

  [SavefileDataType.OathType]:                (offset: number) => ({ start: offset + 4,   end: offset + 6 }),
  [SavefileDataType.SuitOrder]:               (offset: number) => ({ start: offset + 6,   end: offset + 12 }),
  [SavefileDataType.Site1]:                   (offset: number) => ({ start: offset + 12,  end: offset + 14 }),
  [SavefileDataType.Site2]:                   (offset: number) => ({ start: offset + 20,  end: offset + 22 }),
  [SavefileDataType.Site3]:                   (offset: number) => ({ start: offset + 28,  end: offset + 30 }),
  [SavefileDataType.Site4]:                   (offset: number) => ({ start: offset + 36,  end: offset + 38 }),
  [SavefileDataType.Site5]:                   (offset: number) => ({ start: offset + 44,  end: offset + 46 }),
  [SavefileDataType.Site6]:                   (offset: number) => ({ start: offset + 52,  end: offset + 54 }),
  [SavefileDataType.Site7]:                   (offset: number) => ({ start: offset + 60,  end: offset + 62 }),
  [SavefileDataType.Site8]:                   (offset: number) => ({ start: offset + 68,  end: offset + 70 }),
  [SavefileDataType.WorldDeckSize]:           (offset: number) => ({ start: offset + 76,  end: offset + 78 }),

  // offset dynamically set to world deck size between these places

  [SavefileDataType.DispossessedDeckSize]:    (offset: number) => ({ start: offset + 0,   end: offset + 2 }),

  // offset dynamically set to dispossessed deck size between these places

  [SavefileDataType.RelicDeckSize]:           (offset: number) => ({ start: offset + 0,   end: offset + 2 }),

  [SavefileDataType.ExileCitizenStatusPrev]:  (offset: number) => ({ start: offset + 0,   end: offset + 2 }),
  [SavefileDataType.WinningColor]:            (offset: number) => ({ start: offset + 2,   end: offset + 4 }),
};

function parseCitizenshipByte(byte: number): PlayerCitizenship {
  const citizenships: PlayerCitizenship = {
    [PlayerColor.Black]:  Citizenship.Exile,
    [PlayerColor.Yellow]: Citizenship.Exile,
    [PlayerColor.White]:  Citizenship.Exile,
    [PlayerColor.Blue]:   Citizenship.Exile,
    [PlayerColor.Red]:    Citizenship.Exile
  };
  if(byte & colorMask(PlayerColor.Black)) citizenships[PlayerColor.Black] = Citizenship.Citizen;
  if(byte & colorMask(PlayerColor.Yellow)) citizenships[PlayerColor.Yellow] = Citizenship.Citizen;
  if(byte & colorMask(PlayerColor.White)) citizenships[PlayerColor.White] = Citizenship.Citizen;
  if(byte & colorMask(PlayerColor.Blue)) citizenships[PlayerColor.Blue] = Citizenship.Citizen;
  if(byte & colorMask(PlayerColor.Red)) citizenships[PlayerColor.Red] = Citizenship.Citizen;

  return citizenships;
}

function parseColorByte(byte: number): PlayerColor {
  if(byte & colorMask(PlayerColor.Purple)) return PlayerColor.Purple;
  if(byte & colorMask(PlayerColor.Black)) return PlayerColor.Black;
  if(byte & colorMask(PlayerColor.Yellow)) return PlayerColor.Yellow;
  if(byte & colorMask(PlayerColor.White)) return PlayerColor.White;
  if(byte & colorMask(PlayerColor.Blue)) return PlayerColor.Blue;
  if(byte & colorMask(PlayerColor.Red)) return PlayerColor.Red;
  return PlayerColor.Purple;  // Default failsafe case
}

function colorMask(color: PlayerColor): number {
  return {
    [PlayerColor.Purple]: 0x20,
    [PlayerColor.Black]: 0x10,
    [PlayerColor.Yellow]: 0x08,
    [PlayerColor.White]: 0x04,
    [PlayerColor.Blue]: 0x02,
    [PlayerColor.Red]: 0x01
  }[color];
}

function genCitizenshipByte(citizenship: PlayerCitizenship): number {
  let byte = 0x00;
  if(citizenship[PlayerColor.Black] === Citizenship.Citizen) byte |= colorMask(PlayerColor.Black);
  if(citizenship[PlayerColor.Yellow] === Citizenship.Citizen) byte |= colorMask(PlayerColor.Yellow);
  if(citizenship[PlayerColor.White] === Citizenship.Citizen) byte |= colorMask(PlayerColor.White);
  if(citizenship[PlayerColor.Blue] === Citizenship.Citizen) byte |= colorMask(PlayerColor.Blue);
  if(citizenship[PlayerColor.Red] === Citizenship.Citizen) byte |= colorMask(PlayerColor.Red);
  return byte;
}

// Serialize `num` into a hex string `width` chars wide.
//
// The result is 0-padded and matches the format of the TTS hex encodings
// (uppercase).
function hex(num: number, width: number): string {
  const str = num.toString(16).padStart(width, '0').toUpperCase();
  if (str.length > width) {
    throw new Error(
      `number ${num} is wider than ${width} when encoded: ${str}`
    );
  }
  return str;
}

// Serialize a deck into its hex-encoded savefile format.
//
// The first byte is the size of the deck, and each subsequent byte is the id of
// a card in the deck, in order.
function serializeDeck(deck: CardData[]): string {
  const bytes = [deck.length, ...deck.map((card) => CardName[card.name]!)];
  return bytes.map((byte) => hex(byte, 2)).join('');
}

// Serialize a structured `OathGame` into a save file string.
//
// Inverse of `parseOathTTSSavefileString`.
export function serializeOathGame(game: OathGameData): string {
  const oathMajor = parseInt(game.version.major, 10);
  const oathMinor = parseInt(game.version.minor, 10);
  const oathPatch = parseInt(game.version.patch, 10);

  if (oathMajor < 3 || (oathMajor === 3 && oathMinor < 1)) {
    throw new Error('Oath savefile version 3.1.0 is the minimum required.');
  }

  // See `basicDataString` in lua mod for format.
  const basicData: string[] = [
    hex(oathMajor, 2),
    hex(oathMinor, 2),
    hex(oathPatch, 2),
    hex(game.gameCount, 4),
    hex(game.chronicleName.length, 2),
    game.chronicleName,

    // TODO: in >= 3.3.2, this empty byte is replaced with the active player
    // status. This needs to be added to `OathGame` and the parser and then
    // added here.
    hex(0, 2), // empty byte

    hex(genCitizenshipByte(game.playerCitizenship), 2),
    hex(game.oath, 2),
    ...game.suitOrder.map((suit) => hex(suit, 1)),
  ];


  // See `mapDataString` in lua mod for format.
  const mapData: string[] = game.sites.map((site) => {
    const siteId = CompleteSiteName[site.name]!;
    const bytes: number[] = [siteId];
    if (site.facedown && siteId !== CompleteSiteName.NONE) {
      bytes[0]! += 24;
    }
    site.cards.forEach((card) => {
      bytes.push(CardName[card.name]!);
    });
    return bytes.map((byte) => hex(byte, 2)).join('');
  });

  const worldDeck: string = serializeDeck(game.world);
  const dispossessedDeck: string = serializeDeck(game.dispossessed);
  const relicDeck: string = serializeDeck(game.relics);

  let chunks = [
    ...basicData,
    ...mapData,
    worldDeck,
    dispossessedDeck,
    relicDeck,
  ];

  // Add previous game data if >= 3.3.1
  (() => {
    // TODO: should use a semver package for version checks.
    if (oathMajor < 3) return;
    if (oathMajor === 3) {
      if (oathMinor < 3) return;
      if (oathMinor === 3) {
        if (oathPatch < 1) return;
      }
    }

    // See `previousGameInfoString` in lua mod for format.
    // TODO: `OathGame` doesn't yet hold the previous winner's name,
    // so use the default from the lua mod.
    const winnerSteamName = "UNKNOWN";
    const previousGameData: string[] = [
      hex(genCitizenshipByte(game.prevPlayerCitizenship), 2),
      hex(colorMask(game.winner), 2),
      hex(winnerSteamName.length, 2),
      winnerSteamName,
    ];
    chunks = [...chunks, ...previousGameData];
  })();

  return chunks.join('');
}

export function parseOathTTSSavefileString(saveDataString: string): OathGameData {
  let parseOffsetForName = 0;
  console.log(saveDataString);

  function getHexFromStringAsNumber(startIndex: number, endIndex: number): number {
    const parsedString = saveDataString.substring(startIndex, endIndex);
    if(!parsedString) throw new Error(`Could not parse savefile ${startIndex}...${endIndex} - returned blank.`);

    const parsedNumber = parseInt(parsedString, 16);
    if(isNaN(parsedNumber)) throw new Error(`Savefile ${startIndex}...${endIndex} is NaN - something is wrong.`);

    return parsedNumber;
  }

  function getStartEndByIndex(type: SavefileDataType): { start: number, end: number } {
    return Indices[type](parseOffsetForName);
  }

  function getHexByIndex(type: SavefileDataType): number {
    const { start, end } = getStartEndByIndex(type);
    return getHexFromStringAsNumber(start, end);
  }

  function updateOffset(newOffset: number): void {
    parseOffsetForName = newOffset;
  }

  const game: Partial<OathGameData> = {};

  // the first 6 characters represent the version of the savefile
  const oathMajor = getHexByIndex(SavefileDataType.VersionMajor);
  const oathMinor = getHexByIndex(SavefileDataType.VersionMinor);
  const oathPatch = getHexByIndex(SavefileDataType.VersionPatch);

  game.version = { 
    major: oathMajor.toString(), 
    minor: oathMinor.toString(), 
    patch: oathPatch.toString() 
  };

  if (oathMajor < 3 || oathMajor === 3 && oathMinor < 1) {
    throw new Error('Oath savefile version 3.1.0 is the minimum required.');
  }

  // the first X bytes are always going to be related to 1.6.0
  const parseData_1_6_0 = () => {

    // parse game count
    game.gameCount = getHexByIndex(SavefileDataType.GameCount);

    // get the length of the name
    const nameLength = getHexByIndex(SavefileDataType.ChronicleNameLength);
    const { end: nameEnd } = Indices[SavefileDataType.ChronicleNameLength](0);

    // get the name
    game.chronicleName = saveDataString.substring(nameEnd, nameEnd + nameLength);

    // set the new offset to the game name, since everything after name needs to know the length of it
    updateOffset(nameEnd + nameLength);

    // validate the name
    if(game.chronicleName.length < CHRONICLE_NAME_MIN_LENGTH
    || game.chronicleName.length > CHRONICLE_NAME_MAX_LENGTH) {
      throw new Error(`Chronicle name must be between ${CHRONICLE_NAME_MIN_LENGTH} and ${CHRONICLE_NAME_MAX_LENGTH} (${game.chronicleName} is ${game.chronicleName.length})`);
    } 

    // we throw the player status out, but it's here so it's not forgotten about
    getHexByIndex(SavefileDataType.PlayerStatus);

    // get citizenship for each player
    const exileCitizenStatusByte = getHexByIndex(SavefileDataType.ExileCitizenStatus);
    game.playerCitizenship = parseCitizenshipByte(exileCitizenStatusByte);

    // parse the oath from the game
    game.oath = getHexByIndex(SavefileDataType.OathType);
    if(!(game.oath in OathType)) throw new Error(`Invalid Oath value was found while parsing the savefile: ${game.oath}`);

    // Load suit order. This is unused in retail Oath but still
    // part of the save file format.
    game.suitOrder = [];
    const { start: suitOrderStart, end: suitOrderEnd } = getStartEndByIndex(SavefileDataType.SuitOrder);
    for (let i = suitOrderStart; i < suitOrderEnd; i++) {
      const suit = getHexFromStringAsNumber(i, i + 1);
      game.suitOrder.push(suit);
    }

    // load sites
    game.sites = [
      SavefileDataType.Site1,
      SavefileDataType.Site2,
      SavefileDataType.Site3,
      SavefileDataType.Site4,
      SavefileDataType.Site5,
      SavefileDataType.Site6,
      SavefileDataType.Site7,
      SavefileDataType.Site8
    ]
    .map(siteSlot => {
      const { start: siteStart, end: siteEnd } = getStartEndByIndex(siteSlot);
      const siteData = getHexFromStringAsNumber(siteStart, siteEnd);
      
      const cards = Array(3).fill(null).map((n, i) => {
        const cardData = getHexFromStringAsNumber(siteEnd + (2 * i), siteEnd + (2 * (i + 1)));
        return { name: CardNameIndexes[cardData]! };
      });

      return { 
        name: SiteNameIndexes[siteData]!, 
        facedown: siteData >= 24,
        cards
      };
    });

    // load world deck count
    const { start: worldStart, end: worldEnd } = getStartEndByIndex(SavefileDataType.WorldDeckSize);
    const numWorldCards = getHexFromStringAsNumber(worldStart, worldEnd);

    // load world deck
    game.world = Array(numWorldCards).fill(null).map((n, i) => {
      const cardData = getHexFromStringAsNumber(worldEnd + (2 * i), worldEnd + (2 * (i + 1)));
      return { name: CardNameIndexes[cardData]! };
    });
    
    updateOffset(worldEnd + (2 * numWorldCards));

    // load dispossessed cards
    const { start: dispStart, end: dispEnd } = getStartEndByIndex(SavefileDataType.DispossessedDeckSize);
    const numDispossessed = getHexFromStringAsNumber(dispStart, dispEnd);

    game.dispossessed = Array(numDispossessed).fill(null).map((n, i) => {
      const cardData = getHexFromStringAsNumber(dispEnd + (2 * i), dispEnd + (2 * (i + 1)));
      return { name: CardNameIndexes[cardData]! };
    });
    
    updateOffset(dispEnd + (2 * numDispossessed));
  };
  
  // 3.1.0 adds relics, so they require additional parsing
  const parseData_3_1_0 = () => {

    // load relic cards
    const { start: relicStart, end: relicEnd } = getStartEndByIndex(SavefileDataType.RelicDeckSize);
    const numRelics = getHexFromStringAsNumber(relicStart, relicEnd);

    game.relics = Array(numRelics).fill(null).map((n, i) => {
      const cardData = getHexFromStringAsNumber(relicEnd + (2 * i), relicEnd + (2 * (i + 1)));
      return { name: CardNameIndexes[cardData]! };
    });
    
    updateOffset(relicEnd + (2 * numRelics));
  };
  
  // 3.1.1 adds previous citizenship and winner color
  const parseData_3_1_1 = () => {
    if(oathMajor < 3 || oathMinor < 1 || oathPatch < 1) return;

    // load citizenship
    const prevExileCitizenStatusByte = getHexByIndex(SavefileDataType.ExileCitizenStatusPrev);
    game.prevPlayerCitizenship = parseCitizenshipByte(prevExileCitizenStatusByte);
    
    const winnerColor = parseColorByte(getHexByIndex(SavefileDataType.WinningColor));
    game.winner = winnerColor;
  };

  parseData_1_6_0();
  parseData_3_1_0();
  parseData_3_1_1();

  return game as OathGameData;
};
