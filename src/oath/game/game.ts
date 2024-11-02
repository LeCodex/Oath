import { InvalidActionResolution, OathAction, ChoosePlayersAction, SetupChooseAction, WakeAction, ChooseSitesAction } from "./actions/actions";
import { OathActionManager } from "./actions/manager";
import { DrawFromDeckEffect, PutPawnAtSiteEffect, SetNewOathkeeperEffect, SetUsurperEffect, WinGameEffect } from "./effects";
import { OathPower } from "./powers/powers";
import { OathBoard, Region } from "./board";
import { RelicDeck, SiteDeck, WorldDeck } from "./cards/decks";
import { DenizenData, denizenData, edificeData } from "./cards/denizens";
import { relicsData } from "./cards/relics";
import { sitesData } from "./cards/sites";
import { OathPhase, OathSuit, RegionName, PlayerColor, ALL_OATH_SUITS, BannerName } from "./enums";
import { Oath, OathOfDevotion, OathOfProtection, OathOfSupremacy, OathOfThePeople, OathTypeToOath } from "./oaths";
import { Conspiracy, Denizen, Edifice, GrandScepter, Relic, Site, Vision, WorldCard } from "./cards/cards";
import { Chancellor, Exile, OathPlayer } from "./player";
import { Banner, DarkestSecret, FavorBank, PeoplesFavor } from "./banks";
import { AbstractConstructor, Constructor, isExtended, TreeNode, TreeRoot } from "./utils";
import { parseOathTTSSavefileString, serializeOathGame } from "./parser";
import { Citizenship } from "./parser/interfaces";
import { hasPowers, SourceType, WithPowers } from "./interfaces";
import { Favor, Secret } from "./resources";


export class OathGame extends TreeRoot<OathGame> {
    actionManager = new OathActionManager(this);
    
    seed: string;
    name: string;
    chronicleNumber: number;
    oath: Oath;
    isUsurper = false;
    
    turn = 0;
    phase = OathPhase.Act;
    round = 1;
    order: PlayerColor[] = [PlayerColor.Purple];

    // References for quick access to static elements
    chancellor: Chancellor;
    worldDeck: WorldDeck;
    relicDeck: RelicDeck;
    siteDeck: SiteDeck;
    board: OathBoard;
    grandScepter: GrandScepter;
    banners = new Map<BannerName, Banner>;

    archive: Record<string, DenizenData>;
    dispossessed: Record<string, DenizenData>;

    constructor(seed: string, playerCount: number) {
        super();
        this.seed = seed;

        this.banners.set(BannerName.PeoplesFavor, this.addChild(new PeoplesFavor()));
        this.banners.set(BannerName.DarkestSecret, this.addChild(new DarkestSecret()));
        this.worldDeck = this.addChild(new WorldDeck());
        this.relicDeck = this.addChild(new RelicDeck());
        this.siteDeck = this.addChild(new SiteDeck());
        for (let i = 0; i < 36; i++) this.addChild(new Favor());

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
            if (data) {
                this.worldDeck.addChild(new Denizen(cardData.name, ...data), true);
                continue;
            }

            let card: WorldCard | undefined = {
                Conspiracy: new Conspiracy(),
                Sanctuary: new Vision(new OathOfProtection()),
                Rebellion: new Vision(new OathOfThePeople()),
                Faith: new Vision(new OathOfDevotion()),
                Conquest: new Vision(new OathOfSupremacy())
            }[cardData.name];
                
            if (card)
                this.worldDeck.addChild(card, true);
            else
                console.warn("Couldn't load " + cardData.name + " into World Deck");
        }

        for (const cardData of gameData.relics) {
            const data = relicsData[cardData.name];
            if (!data) {
                console.warn("Couldn't load " + cardData.name+ " into relic deck");
                continue;
            }
            this.relicDeck.addChild(new Relic(cardData.name, ...data), true);
        }

        this.chancellor = this.addChild(new Chancellor());
        for (let i = 1; i < playerCount; i++) {
            this.addChild(new Exile(i));
            this.order.push(i);
        }

        this.board = this.addChild(new OathBoard());
        let regionName: RegionName = RegionName.Cradle;
        const siteKeys: string[] = [];
        for (const siteData of gameData.sites) {
            let key = siteData.name;
            if (!(key in sitesData)) {
                const keys = Object.keys(sitesData).filter(e => !siteKeys.includes(e));
                key = keys[Math.floor(Math.random() * keys.length)]!;  // Only undefined if the keys are empty, in which case we have bigger issues
                console.warn("Couldn't load " + siteData.name + ", defaulting to a random site: " + key);
            }
            siteKeys.push(key);
            const region = this.board.byClass(Region).byId(regionName)[0]!;
            const site = new Site(region, key, ...sitesData[key]!);
            site.facedown = siteData.facedown;
            if (!site.facedown) site.setupResources();

            for (const denizenOrRelicData of siteData.cards) {
                const denizen = denizenData[denizenOrRelicData.name];
                if (denizen) {
                    const card = new Denizen(denizenOrRelicData.name, ...denizen);
                    site.addChild(card).reveal();
                    continue;
                }

                const edifice = edificeData[denizenOrRelicData.name];
                if (edifice) {
                    const [_, ...data] = edifice;
                    const card = new Edifice(denizenOrRelicData.name, ...data);
                    site.addChild(card).reveal();
                    continue;
                }

                const relic = relicsData[denizenOrRelicData.name];
                if (relic) {
                    site.addChild(new Relic(denizenOrRelicData.name, ...relic));
                    continue;
                }
                
                console.warn("Couldn't load " + denizenOrRelicData.name + " for " + key);
            }

            region.addChild(site);
            if (region.byClass(Site).length >= region.size) regionName++;
        }
        
        const regions = this.board.byClass(Region);
        for (const region of regions) {
            const fromBottom = this.worldDeck.drawSingleCard(true);
            if (fromBottom) region.discard.addChild(fromBottom);
        }
        const topCradleSite = regions.byId(RegionName.Cradle)[0]?.byClass(Site)[0]!;

        const players = this.byClass(OathPlayer);
        for (const player of players) {
            player.putResources(Favor, player === this.chancellor ? 2 : 1);
            player.putResources(Secret, 1);
            player.leader.bag.moveChildrenTo(player, 3);

            const cards = new DrawFromDeckEffect(player, this.worldDeck, 3, true).do();
            
            if (player !== this.chancellor)
                new ChooseSitesAction(
                    player, "Put your pawn at a faceup site (Hand: " + cards.map(e => e.name).join(", ") + ")",
                    (sites: Site[]) => { if (sites[0]) new PutPawnAtSiteEffect(player, sites[0]).do(); }
                ).doNext();
            else
                new PutPawnAtSiteEffect(player, topCradleSite).do();
            
            new SetupChooseAction(player, cards).doNext();
        }

        this.grandScepter = new GrandScepter();
        this.chancellor.addChild(this.grandScepter).reveal();

        for (const site of this.board.sites()) 
            if (site !== topCradleSite && site.byClass(Denizen).filter(e => e.suit !== OathSuit.None).length)
                this.chancellor.bag.moveChildrenTo(site, 1);
        this.chancellor.bag.moveChildrenTo(topCradleSite, 3);
        
        const startingAmount = playerCount < 5 ? 3 : 4;
        for (let i = OathSuit.Discord; i <= OathSuit.Nomad; i++)
            this.addChild(new FavorBank(i, startingAmount));

        this.oath = this.chancellor.addChild(new OathTypeToOath[gameData.oath]());
        this.addChild(this.oath).setup();

        new WakeAction(this.currentPlayer).doNext();
    }

    get players() { return this.byClass(OathPlayer); }
    get currentPlayer() { return this.players.byId(this.order[this.turn]!)[0]!; }
    get oathkeeper() { return this.oath.owner ?? this.chancellor; }
    
    favorBank(suit: OathSuit) {
        return this.byClass(FavorBank).byId(suit)[0];
    }

    takeCardDataFromArchive(key: string) {
        const data = this.archive[key];
        if (data) delete this.archive[key];
        return data;
    }

    getPowers<T extends OathPower<WithPowers>>(type: AbstractConstructor<T>): [SourceType<T>, Constructor<T>][] {
        const powers: [any, Constructor<T>][] = [];

        let stack: TreeNode<any>[] = [...this.children];
        while (stack.length) {
            const node = stack.pop()!;
            for (const child of node.children)
                stack.push(child);
            
            if (hasPowers(node))
                for (const power of node.powers)
                    if (isExtended(power, type)) powers.push([node, power]);
        }

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
                    if (!targets[0]) return;
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
            (targets: OathPlayer[]) => { if (targets[0]) new WinGameEffect(targets[0]).do(); },
            [[...candidates].filter(e => e instanceof Exile && e.isCitizen)]
        ).doNext();
    }

    serialize(): Record<string, any> {
        const obj = super.serialize();
        return {
            name: this.name,
            chronicleNumber: this.chronicleNumber,
            oathkeeper: this.oathkeeper.id,
            isUsurper: this.isUsurper,
            turn: this.turn,
            phase: this.phase,
            round: this.round,
            order: this.order,
            seed: this.seed,
            ...obj
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
            oath: this.oath.id,
            suitOrder: ALL_OATH_SUITS,
            sites: [...this.board.sites()].map(e => ({ name: e.name, facedown: e.facedown, cards: [...e.denizens, ...e.relics].map(e => ({ name: e.name })) })),
            world: this.worldDeck.children.map(e => ({ name: e.name })),
            dispossessed: Object.keys(this.dispossessed).map(e => ({ name: e })),
            relics: this.relicDeck.children.map(e => ({ name: e.name })),
        
            prevPlayerCitizenship: {[1]: Citizenship.Exile, [2]: Citizenship.Exile, [3]: Citizenship.Exile, [4]: Citizenship.Exile, [5]: Citizenship.Exile},
            winner: winner
        })
    }
}

