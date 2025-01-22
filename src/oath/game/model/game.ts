import { OathMap, Region } from "./map";
import { Discard, RelicDeck, WorldDeck } from "./decks";
import type { DenizenName } from "../cards/denizens";
import { denizenData, edificeFlipside } from "../cards/denizens";
import type { RelicName } from "../cards/relics";
import { relicsData } from "../cards/relics";
import { OathPhase, OathSuit, RegionKey, PlayerColor, ALL_OATH_SUITS, BannerKey } from "../enums";
import { OathkeeperTile } from "./oaths";
import { Conspiracy, Denizen, Edifice, GrandScepter, Relic, Site, Vision } from "./cards";
import type { PlayerBoard } from "./player";
import { OathPlayer } from "./player";
import type { Banner} from "./banks";
import { DarkestSecret, FavorBank, PeoplesFavor } from "./banks";
import { MurmurHash3, PRNG } from "../utils";
import { TreeRoot } from "./utils";
import { parseOathTTSSavefileString, serializeOathGame } from "../parser";
import type { CardName, PlayerCitizenship } from "../parser/interfaces";
import { Citizenship } from "../parser/interfaces";
import { Favor, Secret } from "./resources";
import { Reliquary, ReliquarySlot } from "./reliquary";
import { constant, times } from "lodash";
import type { SiteName } from "../cards/sites";
import classIndex from "./classIndex";


export class OathGame extends TreeRoot<OathGame> {
    classIndex = classIndex;

    random: PRNG;

    seed: string;
    name: string;
    chronicleNumber: number;
    isUsurper = false;

    turn = 0;
    phase = OathPhase.Act;
    round = 1;
    order: number[] = [];

    banners = new Map<BannerKey, Banner>;

    archive: Set<DenizenName>;
    dispossessed: Set<DenizenName>;
    oldCitizenship: PlayerCitizenship;

    constructor(public gameId: number, public setupData: [string, string[]]) {
        super();
        this.setup(setupData);
    }

    // References for quick access to "static" elements
    /* eslint-disable-next-line @typescript-eslint/no-non-null-asserted-optional-chain */
    get chancellor() { return this.search<PlayerBoard>("board", PlayerColor.Purple)?.typedParent(OathPlayer)!; }
    get oathkeeperTile() { return this.search<OathkeeperTile>("oath", "Oath")!; }
    get reliquary() { return this.search<Reliquary>("reliquary", "reliquary")!; }
    get worldDeck() { return this.search<WorldDeck>("deck", "worldDeck")!; }
    get relicDeck() { return this.search<RelicDeck>("deck", "relicDeck")!; }
    get map() { return this.search<OathMap>("map", "map")!; }
    get grandScepter() { return this.search<GrandScepter>("relic", "GrandScepter")!; }
    
    setup([seed, playerNames]: this["setupData"]) {
        this.seed = seed;
        this.random = new PRNG(MurmurHash3(this.seed));

        this.addChild(new WorldDeck());
        this.addChild(new RelicDeck());
        for (let i = 0; i < 36; i++) this.addChild(new Favor());

        const peoplesFavor = new PeoplesFavor();
        const darkestSecret = new DarkestSecret();
        this.banners.set(BannerKey.PeoplesFavor, this.addChild(peoplesFavor));
        this.banners.set(BannerKey.DarkestSecret, this.addChild(darkestSecret));
        Favor.putOn(peoplesFavor, 1);
        Secret.putOn(darkestSecret, 1);

        const gameData = parseOathTTSSavefileString(this.seed);
        this.name = gameData.chronicleName;
        this.chronicleNumber = gameData.gameCount;

        this.archive = new Set(Object.keys(denizenData) as DenizenName[]);
        this.dispossessed = new Set();

        for (const cardData of gameData.dispossessed) {
            this.archive.delete(cardData.name as DenizenName);
            this.dispossessed.add(cardData.name as DenizenName);
        }

        for (const cardData of gameData.world) {
            const existing = this.archive.delete(cardData.name as DenizenName);
            if (existing) {
                this.worldDeck.addChild(new Denizen(cardData.name as DenizenName));
                continue;
            }

            const card = {
                Conspiracy: new Conspiracy(),
                Sanctuary: new Vision("Protection"),
                Rebellion: new Vision("ThePeople"),
                Faith: new Vision("Devotion"),
                Conquest: new Vision("Supremacy")
            }[cardData.name as string];

            if (card)
                this.worldDeck.addChild(card);
            else
                console.warn(`Couldn't load ${cardData.name} into World Deck`);
        }

        for (const cardData of gameData.relics) {
            const data = relicsData[cardData.name as RelicName];
            if (!data) {
                console.warn(`Couldn't load ${cardData.name} into relic deck`);
                continue;
            }
            this.relicDeck.addChild(new Relic(cardData.name as RelicName));
        }

        for (const [i, name] of playerNames.entries()) {
            const player = this.addChild(new OathPlayer(String(i)));
            player.name = name;
        }
        this.oldCitizenship = gameData.playerCitizenship;

        this.addChild(new Reliquary());
        for (let i = 0; i < 4; i++) this.reliquary.addChild(new ReliquarySlot(String(i))).getRelic();

        this.addChild(new OathMap());
        for (let i = RegionKey.Cradle; i <= RegionKey.Hinterland; i++) {
            const id = RegionKey[i] as keyof typeof RegionKey;
            this.map.addChild(new Region(id));
            this.addChild(new Discard(id));
        }

        let regionKey: RegionKey = RegionKey.Cradle;
        const siteKeys: string[] = [];
        for (const siteData of gameData.sites) {
            const siteId = siteData.name as SiteName;
            siteKeys.push(siteId);
            const region = this.map.byClass(Region).byKey(regionKey)[0]!;
            const site = region.addChild(new Site(siteId));
            site.facedown = siteData.facedown;
            if (!site.facedown) site.setupResources();

            for (const denizenOrRelicData of siteData.cards) {
                const cardId = denizenOrRelicData.name;
                if (cardId in denizenData) {
                    const card = cardId in edificeFlipside ? new Edifice(cardId as DenizenName) : new Denizen(cardId as DenizenName);
                    site.addChild(card).turnFaceup();
                    continue;
                }

                if (cardId in relicsData) {
                    site.addChild(new Relic(cardId as RelicName));
                    continue;
                }

                console.warn(`Couldn't load ${cardId} for ${siteId}`);
            }

            if (region.byClass(Site).length >= region.size) regionKey++;
        }

        const regions = this.map.children;
        for (const region of regions) {
            const fromBottom = this.worldDeck.drawSingleCard(true);
            if (fromBottom) region.discard.addChild(fromBottom);
        }
        
        const startingAmount = this.players.length < 5 ? 3 : 4;
        for (let i = OathSuit.Discord; i <= OathSuit.Nomad; i++) {
            const bank = this.addChild(new FavorBank(OathSuit[i] as keyof typeof OathSuit));
            Favor.putOn(bank, startingAmount);
        }
        
        this.addChild(new GrandScepter());
        this.addChild(new OathkeeperTile()).setType(gameData.oath);
    }

    get players() {
        const unordered = this.byClass(OathPlayer);
        return this.order ? unordered.sort((a, b) => this.order.indexOf(a.key) - this.order.indexOf(b.key)) : unordered;
    }
    private get currentId() { return this.order[this.turn]; }
    get currentPlayer() { return this.currentId !== undefined ? this.players.byKey(this.currentId)[0]! : this.players[0]!; }
    get oathkeeper() { return this.oathkeeperTile.owner ?? this.chancellor; }

    favorBank(suit: OathSuit) {
        return this.byClass(FavorBank).byKey(suit)[0];
    }

    liteSerialize() {
        return {
            ...super.liteSerialize(),
            name: this.name,
            chronicleNumber: this.chronicleNumber,
            isUsurper: this.isUsurper,
            turn: this.turn,
            phase: this.phase,
            round: this.round,
            order: this.order,
            seed: this.seed,
            randomSeed: this.random.seed,
        };
    } 
    
    constSerialize(): Record<`_${string}`, any> {
        return {
            ...super.constSerialize(),
            _currentPlayer: this.currentPlayer.id,
            _oathkeeper: this.oathkeeper?.key,
        }
    }

    parse(obj: ReturnType<this["liteSerialize"]>, allowCreation: boolean = false) {
        super.parse(obj, allowCreation);
        this.name = obj.name;
        this.chronicleNumber = obj.chronicleNumber;
        this.isUsurper = obj.isUsurper;
        this.turn = obj.turn;
        this.phase = obj.phase;
        this.round = obj.round;
        this.order = obj.order;
        this.seed = obj.seed;
        this.random.seed = obj.randomSeed;
    }

    updateSeed(winner: PlayerColor) {
        const newCitizenship = { ...this.oldCitizenship };
        for (const player of this.players) {
            if (player.board.key === PlayerColor.Purple) continue;
            newCitizenship[player.board.key] = player.isImperial ? Citizenship.Citizen : Citizenship.Exile
        }

        this.seed = serializeOathGame({
            version: {
                major: '3',
                minor: '3',
                patch: '1'
            },

            chronicleName: this.name,
            gameCount: this.chronicleNumber + 1,
            
            playerCitizenship: newCitizenship,
            oath: this.oathkeeperTile.oath.oathType,
            suitOrder: ALL_OATH_SUITS,
            sites: [...this.map.sites()].map(e => ({ name: e.id, facedown: e.facedown, cards: [...e.denizens, ...times(3 - e.denizens.length - e.relics.length, constant({ id: "NONE" as const })), ...e.relics].map(e => ({ name: e.id })) })),
            world: this.worldDeck.children.map(e => ({ name: e.id as keyof typeof CardName })),
            dispossessed: [...this.dispossessed].map(e => ({ name: e })),
            relics: this.relicDeck.children.map(e => ({ name: e.id })),

            prevPlayerCitizenship: this.oldCitizenship,
            winner: winner
        });
    }

    stringify() {
        return JSON.stringify(this.setupData)
    }
}
