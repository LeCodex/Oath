import { InvalidActionResolution, OathAction, ChoosePlayersAction, SetupChooseAction, WakeAction, ChooseSitesAction } from "./actions/actions";
import { OathActionManager } from "./actions/manager";
import { DrawFromDeckEffect, PutPawnAtSiteEffect, SetNewOathkeeperEffect, SetUsurperEffect, WinGameEffect } from "./effects";
import { OathPower } from "./powers/powers";
import { OathBoard } from "./board";
import { CardDeck, WorldDeck } from "./cards/decks";
import { DenizenData, denizenData, edificeData } from "./cards/denizens";
import { relicsData } from "./cards/relics";
import { sitesData } from "./cards/sites";
import { BannerName, OathPhase, OathSuit, RegionName, PlayerColor, OathResource, ALL_OATH_SUITS } from "./enums";
import { Oath, OathOfDevotion, OathOfProtection, OathOfSupremacy, OathOfThePeople, OathTypeToOath } from "./oaths";
import { Conspiracy, Denizen, Edifice, GrandScepter, Relic, Site, Vision, WorldCard } from "./cards/cards";
import { Chancellor, Exile, OathPlayer } from "./player";
import { Banner, DarkestSecret, FavorBank, PeoplesFavor } from "./banks";
import { AbstractConstructor, Constructor, isExtended, WithOriginal } from "./utils";
import { parseOathTTSSavefileString, serializeOathGame } from "./parser";
import { Citizenship } from "./parser/interfaces";
import { SourceType, WithPowers } from "./interfaces";


export class OathGame extends WithOriginal {
    actionManager = new OathActionManager(this);
    
    seed: string;
    name: string;
    chronicleNumber: number;
    oath: Oath;
    oathkeeper: OathPlayer;
    isUsurper = false;
    
    turn = 0;
    phase = OathPhase.Act;
    round = 1;

    chancellor: Chancellor;
    grandScepter = new GrandScepter(this);
    players: Record<number, OathPlayer> = {};
    order: PlayerColor[] = [PlayerColor.Purple];

    archive: Record<string, DenizenData>;
    dispossessed: Record<string, DenizenData>;

    banners = new Map<BannerName, Banner>([
        [BannerName.PeoplesFavor, new PeoplesFavor(this, 1)],
        [BannerName.DarkestSecret, new DarkestSecret(this, 1)]
    ]);
    favorBanks: Map<OathSuit, FavorBank>;
    worldDeck = new WorldDeck(this);
    relicDeck = new CardDeck<Relic>(this);
    siteDeck = new CardDeck<Site>(this);
    board: OathBoard;

    constructor(seed: string, playerCount: number) {
        super();
        this.seed = seed;

        const gameData = parseOathTTSSavefileString(seed);
        this.name = gameData.chronicleName;
        this.chronicleNumber = gameData.gameCount;

        this.archive = {...denizenData};
        this.dispossessed = {};

        for (const cardData of gameData.dispossessed) {
            const data = this.takeCardDataFromArchive(cardData.name);
            if (data) this.dispossessed[cardData.name] = data;
        }

        for (const cardData of gameData.world) {
            const data = this.takeCardDataFromArchive(cardData.name);
            if (!data) {
                let card: WorldCard | undefined = {
                    Conspiracy: new Conspiracy(this),
                    Sanctuary: new Vision(new OathOfProtection(this)),
                    Rebellion: new Vision(new OathOfThePeople(this)),
                    Faith: new Vision(new OathOfDevotion(this)),
                    Conquest: new Vision(new OathOfSupremacy(this))
                }[cardData.name];
                    
                if (card)
                    this.worldDeck.putCard(card, true);
                else
                    console.warn("Couldn't load " + cardData.name + " into World Deck");

                continue;
            }
            
            this.worldDeck.putCard(new Denizen(this, cardData.name, ...data), true);
        }
        
        for (const cardData of gameData.relics) {
            const data = relicsData[cardData.name];
            if (!data) {
                console.warn("Couldn't load " + cardData.name+ " into relic deck");
                continue;
            }
            this.relicDeck.putCard(new Relic(this, cardData.name, ...data), true);
        }

        this.oathkeeper = this.chancellor = new Chancellor(this);
        this.players[PlayerColor.Purple] = this.chancellor;
        for (let i = 1; i < playerCount; i++) {
            this.players[i] = new Exile(this, i);
            this.order.push(i);
        }

        this.board = new OathBoard(this);
        let regionIndex: RegionName = RegionName.Cradle, siteKeys: string[] = [];
        for (const siteData of gameData.sites) {
            let key = siteData.name;
            if (!(key in sitesData)) {
                const keys = Object.keys(sitesData).filter(e => !siteKeys.includes(e));
                key = keys[Math.floor(Math.random() * keys.length)];
                console.warn("Couldn't load " + siteData.name + ", defaulting to a random site: " + key);
            }
            siteKeys.push(key);
            const region = this.board.regions[regionIndex];
            const site = new Site(this, region, key, ...sitesData[key]);
            site.facedown = siteData.facedown;
            if (!site.facedown) site.setupResources();

            for (const denizenOrRelicData of siteData.cards) {
                const denizen = denizenData[denizenOrRelicData.name];
                if (denizen) {
                    const card = new Denizen(this, denizenOrRelicData.name, ...denizen);
                    card.putAtSite(site);
                    card.reveal();
                    continue;
                }

                const edifice = edificeData[denizenOrRelicData.name];
                if (edifice) {
                    const [_, ...data] = edifice;
                    const card = new Edifice(this, denizenOrRelicData.name, ...data);
                    card.putAtSite(site);
                    card.reveal();
                    continue;
                }

                const relic = relicsData[denizenOrRelicData.name];
                if (relic) {
                    new Relic(this, denizenOrRelicData.name, ...relic).putAtSite(site);
                    continue;
                }
                
                console.warn("Couldn't load " + denizenOrRelicData.name + " for " + key);
            }

            region.sites.push(site);
            if (region.sites.length >= region.size) regionIndex++;
        }

        for (const region of Object.values(this.board.regions)) {
            const fromBottom = this.worldDeck.drawSingleCard(true);
            if (fromBottom) region.discard.putCard(fromBottom);
        }
        const topCradleSite = this.board.regions[RegionName.Cradle].sites[0];

        for (const [color, player] of Object.entries(this.players)) {
            player.putResources(OathResource.Favor, player === this.chancellor ? 2 : 1);  // TODO: Take favor from supply
            player.putResources(OathResource.Secret, 1);
            player.leader.moveWarbandsFromBagOnto(player, 3);

            const cards = new DrawFromDeckEffect(player, this.worldDeck, 3, true).do();
            
            if (player !== this.chancellor)
                new ChooseSitesAction(
                    player, "Put your pawn at a faceup site (Hand: " + cards.map(e => e.name).join(", ") + ")",
                    (sites: Site[]) => { if (sites.length) new PutPawnAtSiteEffect(player, sites[0]).do(); }
                ).doNext();
            else
                new PutPawnAtSiteEffect(player, topCradleSite).do();
            
            new SetupChooseAction(player, cards).doNext();
        }

        this.grandScepter.setOwner(this.chancellor);
        this.grandScepter.facedown = false;

        for (const site of this.board.sites()) 
            if (site !== topCradleSite && [...site.denizens].filter(e => e.suit !== OathSuit.None).length)
                this.chancellor.moveWarbandsFromBagOnto(site, 1);
        this.chancellor.moveWarbandsFromBagOnto(topCradleSite, 2);
        
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

        this.oath = new OathTypeToOath[gameData.oath](this);
        this.oath.setup();

        new WakeAction(this.currentPlayer).doNext();
    }

    get currentPlayer(): OathPlayer { return this.players[this.order[this.turn]]; }

    takeCardDataFromArchive(key: string) {
        const data = this.archive[key];
        if (data) delete this.archive[key];
        return data;
    }

    getPowers<T extends OathPower<WithPowers>>(type: AbstractConstructor<T>): [SourceType<T>, Constructor<T>][] {
        const powers: [any, Constructor<T>][] = [];

        const reliquary = this.chancellor.reliquary;
        for (const slot of reliquary.slots) {
            if (slot.relic) continue;
            for (const power of slot.powers)
                if (isExtended(power, type)) powers.push([slot, power]);
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

    startAction(by: number, actionName: string): object {
        if (this.turn !== by) throw new InvalidActionResolution(`Cannot begin an action outside your turn`);
        if (this.phase !== OathPhase.Act) throw new InvalidActionResolution(`Cannot begin an action outside the Act phase`);
        if (this.actionManager.actionsStack.length) throw new InvalidActionResolution("Cannot start an action while other actions are active");
        
        return this.actionManager.startAction(actionName);
    }

    checkForOathkeeper(): OathAction | undefined {
        const candidates = this.oath.getOathkeeperCandidates();
        if (candidates.has(this.oathkeeper)) return;
        if (candidates.size)
            new ChoosePlayersAction(
                this.oathkeeper, "Choose the new Oathkeeper",
                (targets: OathPlayer[]) => {
                    if (!targets.length) return;
                    new SetUsurperEffect(this, false).do();
                    new SetNewOathkeeperEffect(targets[0]).do();
                }
            ).doNext();
    }

    empireWins() {
        const candidates = this.oath.getSuccessorCandidates();
        if (candidates.has(this.chancellor)) return new WinGameEffect(this.chancellor).do();

        new ChoosePlayersAction(
            this.chancellor, "Choose a Successor",
            (targets: OathPlayer[]) => { if (targets.length) new WinGameEffect(targets[0]).do(); },
            [[...candidates].filter(e => e instanceof Exile && e.isCitizen)]
        ).doNext();
    }

    serialize(): Record<string, any> {
        return {
            name: this.name,
            chronicleNumber: this.chronicleNumber,
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
            board: this.board.serialize(),
            seed: this.seed
        }
    }

    updateSeed(winner: PlayerColor) {
        this.seed = serializeOathGame({
            version: {
                major: '3',
                minor: '3',
                patch: '3'
            },
        
            chronicleName: this.name,
            gameCount: this.chronicleNumber + 1,
            
            // TODO: Store overall state of Citizenships
            playerCitizenship: {[1]: Citizenship.Exile, [2]: Citizenship.Exile, [3]: Citizenship.Exile, [4]: Citizenship.Exile, [5]: Citizenship.Exile},
            oath: this.oath.type,
            suitOrder: ALL_OATH_SUITS,
            sites: [...this.board.sites()].map(e => ({ name: e.name, facedown: e.facedown, cards: [...e.denizens, ...e.relics].map(e => ({ name: e.name })) })),
            world: this.worldDeck.cards.map(e => ({ name: e.name })),
            dispossessed: Object.keys(this.dispossessed).map(e => ({ name: e })),
            relics: this.relicDeck.cards.map(e => ({ name: e.name })),
        
            prevPlayerCitizenship: {[1]: Citizenship.Exile, [2]: Citizenship.Exile, [3]: Citizenship.Exile, [4]: Citizenship.Exile, [5]: Citizenship.Exile},
            winner: winner
        })
    }
}

