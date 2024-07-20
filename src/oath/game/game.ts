import { ChooseNewOathkeeper, InvalidActionResolution, OathAction, OathActionManager } from "./actions";
import { OathBoard } from "./board";
import { Conspiracy, Denizen, Relic, Site, Vision } from "./cards/cards";
import { CardDeck, RelicDeck, WorldDeck } from "./cards/decks";
import { denizenData } from "./cards/denizens";
import { relicsData } from "./cards/relics";
import { sitesData } from "./cards/sites";
import { BannerName, OathType, OathPhase, OathSuit, RegionName, PlayerColor, OathResource } from "./enums";
import { Oath, OathTypeToOath } from "./oaths";
import { Chancellor, Exile, OathPlayer } from "./player";
import { OathPower } from "./powers";
import { Banner, DarkestSecret, FavorBank, PeoplesFavor } from "./resources";
import { AbstractConstructor, Constructor, CopiableWithOriginal, isExtended } from "./utils";


export class OathGame extends CopiableWithOriginal {
    actionManager = new OathActionManager(this);

    oath: Oath;
    oathkeeper: OathPlayer;
    isUsurper = false;

    turn = 0;
    phase = OathPhase.Act;
    round = 1;

    chancellor: Chancellor;
    players: Record<number, OathPlayer> = {};
    order: PlayerColor[] = [PlayerColor.Purple];

    banners = new Map<BannerName, Banner>([
        [BannerName.PeoplesFavor, new PeoplesFavor(this, 1)],
        [BannerName.DarkestSecret, new DarkestSecret(this, 1)]
    ]);
    favorBanks: Map<OathSuit, FavorBank>;
    worldDeck = new WorldDeck(this);
    relicDeck = new RelicDeck(this);
    siteDeck = new CardDeck<Site>(this);
    board: OathBoard;
    
    constructor(oath: OathType, playerCount: number) {
        super();
        this.oath = new OathTypeToOath[oath](this);
        this.oath.setup();

        // TEMP: Just load every card and shuffle evertyhing for now
        for (const data of Object.values(denizenData)) this.worldDeck.putCard(new Denizen(this, ...data));
        for (const oath of Object.values(OathTypeToOath)) this.worldDeck.putCard(new Vision(new oath(this)));
        this.worldDeck.putCard(new Conspiracy(this));
        this.worldDeck.shuffle();
        
        for (const data of Object.values(relicsData)) this.relicDeck.putCard(new Relic(this, ...data));
        this.relicDeck.shuffle();

        for (const data of Object.values(sitesData)) this.siteDeck.putCard(new Site(this, ...data));

        this.board = new OathBoard(this);

        const topCradleSite = this.board.regions[RegionName.Cradle].sites[0];
        this.oathkeeper = this.chancellor = new Chancellor(this, topCradleSite);
        this.players[PlayerColor.Purple] = this.chancellor;
        for (let i = 1; i < playerCount; i++) {
            this.players[i] = new Exile(this, topCradleSite, i);
            this.order.push(i);
        }

        for (const [color, player] of Object.entries(this.players)) {
            player.putResources(OathResource.Favor, Number(color) === PlayerColor.Purple ? 2 : 1);  // TODO: Take favor from supply
            player.putResources(OathResource.Secret, 1);
            player.moveWarbandsFromBagOnto(player, 3);
        }

        for (const region of Object.values(this.board.regions)) this.chancellor.moveWarbandsFromBagOnto(region.sites[0], 1);
        
        // TODO: Take favor from supply
        const startingAmount = playerCount < 5 ? 3 : 4;
        this.favorBanks = new Map([
            [OathSuit.Discord, new FavorBank(this, startingAmount)],
            [OathSuit.Arcane, new FavorBank(this, startingAmount)],
            [OathSuit.Order, new FavorBank(this, startingAmount)],
            [OathSuit.Hearth, new FavorBank(this, startingAmount)],
            [OathSuit.Beast, new FavorBank(this, startingAmount)],
            [OathSuit.Nomad, new FavorBank(this, startingAmount)],
        ]);
    }

    get currentPlayer(): OathPlayer { return this.players[this.order[this.turn]]; }

    getPowers<T extends OathPower<any>>(type: AbstractConstructor<T>): [any, Constructor<T>][] {
        const powers: [any, Constructor<T>][] = [];

        const reliquary = this.chancellor.reliquary;
        for (const [i, power] of reliquary.powers.entries()) {
            if (!reliquary.relics[i] && isExtended(power, type)) powers.push([reliquary, power]);
        }

        for (const site of this.board.sites()) {
            if (site.facedown) continue;
            for (const power of site.powers)
                if (isExtended(power, type)) powers.push([site, power]);

            for (const denizen of site.denizens) {
                if (denizen.facedown) continue;
                for (const power of denizen.powers)
                    if (isExtended(power, type)) powers.push([denizen, power]);
            }
        }

        for (const player of Object.values(this.players)) {
            for (const adviser of player.advisers) {
                if (adviser.facedown) continue;
                for (const power of adviser.powers)
                    if (isExtended(power, type)) powers.push([adviser, power]);
            }

            for (const relic of player.relics) {
                if (relic.facedown) continue;
                for (const power of relic.powers) {
                    if (isExtended(power, type)) powers.push([relic, power]);
                }
            }

            if (player instanceof Exile && player.vision) {
                for (const power of player.vision.powers)
                    if (isExtended(power, type)) powers.push([player.vision, power]);
            }
        }

        for (const banner of this.banners.values())
            for (const power of banner.powers)
                if (isExtended(power, type)) powers.push([banner, power]);

        return powers;
    }

    startAction(by: number, action: Constructor<OathAction>): object {
        if (this.turn !== by) throw new InvalidActionResolution(`Cannot begin an action outside your turn`);
        if (this.phase !== OathPhase.Act) throw new InvalidActionResolution(`Cannot begin an action outside the Act phase`);
        if (this.actionManager.actionStack.length) return new InvalidActionResolution("Cannot start an action while other actions are active");

        new action(this.currentPlayer).doNext();
        return this.actionManager.checkForNextAction();
    }

    checkForOathkeeper(): OathAction | undefined {
        const candidates = this.oath.getCandidates();
        if (candidates.has(this.oathkeeper)) return;
        if (candidates.size) new ChooseNewOathkeeper(this.oathkeeper, candidates).doNext();
    }

    endTurn() {
        this.turn++;
        if (this.turn === Object.keys(this.players).length) this.turn = 0;
    }

    serialize(): Record<string, any> {
        return {
            oath: this.oath.type,
            oathkeeper: this.oathkeeper.color,
            isUsurper: this.isUsurper,
            turn: this.turn,
            phase: this.phase,
            round: this.round,
            order: this.order,
            players: Object.fromEntries(Object.entries(this.players).map(([k, v]) => [k, v.serialize()])),
            banners: Object.fromEntries([...this.banners.entries()].map(([k, v]) => [k, v.serialize()])),
            favorBanks: Object.fromEntries([...this.favorBanks.entries()].map(([k, v]) => [k, v.serialize()])),
            worldDeck: this.worldDeck.serialize(),
            relicDeck: this.relicDeck.serialize(),
            board: this.board.serialize()
        }
    };
}

