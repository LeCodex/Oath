import { ChoosePlayersAction, SetupChooseAction, WakeAction, ChooseSitesAction } from "./actions/actions";
import { InvalidActionResolution, ModifiableAction, OathAction } from "./actions/base";
import { OathActionManager } from "./actions/manager";
import { DrawFromDeckEffect, PutPawnAtSiteEffect, SetNewOathkeeperEffect, SetUsurperEffect, WinGameEffect } from "./actions/effects";
import { ActionModifier, OathPower } from "./powers/powers";
import { OathBoard, Region } from "./board";
import { RelicDeck, SiteDeck, WorldDeck } from "./cards/decks";
import { DenizenData, denizenData, edificeData } from "./cards/denizens";
import { relicsData } from "./cards/relics";
import { OathPhase, OathSuit, RegionKey, PlayerColor, ALL_OATH_SUITS, BannerName, OathType } from "./enums";
import { Oath, OathTypeToOath } from "./oaths";
import { Conspiracy, Denizen, Edifice, GrandScepter, Relic, Site, Vision, WorldCard } from "./cards/cards";
import { Chancellor, Exile, OathPlayer } from "./player";
import { Banner, DarkestSecret, FavorBank, PeoplesFavor } from "./banks";
import { AbstractConstructor, Constructor, isExtended, TreeNode, TreeRoot } from "./utils";
import { parseOathTTSSavefileString, serializeOathGame } from "./parser";
import { Citizenship } from "./parser/interfaces";
import { hasPowers, SourceType, WithPowers } from "./interfaces";
import { Favor, Secret } from "./resources";
import { ReliquarySlot } from "./reliquary";
import classIndex from "./classIndex";


export class OathGame extends TreeRoot<OathGame> {
    type = "root";
    classIndex = classIndex;
    
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
    actionManager = new OathActionManager(this);
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
        
        this.worldDeck = this.addChild(new WorldDeck());
        this.relicDeck = this.addChild(new RelicDeck());
        this.siteDeck = this.addChild(new SiteDeck());
        for (let i = 0; i < 36; i++) this.addChild(new Favor());
        
        const peoplesFavor = new PeoplesFavor();
        const darkestSecret = new DarkestSecret();
        this.banners.set(BannerName.PeoplesFavor, this.addChild(peoplesFavor));
        this.banners.set(BannerName.DarkestSecret, this.addChild(darkestSecret));
        peoplesFavor.putResources(Favor, 1);
        darkestSecret.putResources(Secret, 1);

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
                this.worldDeck.addChild(new Denizen(cardData.name), true);
                continue;
            }

            let card: WorldCard | undefined = {
                Conspiracy: new Conspiracy(),
                Sanctuary: new Vision("Protection"),
                Rebellion: new Vision("ThePeople"),
                Faith: new Vision("Devotion"),
                Conquest: new Vision("Supremacy")
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
            this.relicDeck.addChild(new Relic(cardData.name), true);
        }

        this.chancellor = this.addChild(new Chancellor());
        for (let i = 0; i < 4; i++)
            this.chancellor.reliquary.addChild(new ReliquarySlot(String(i), this.relicDeck.drawSingleCard()));

        for (let i: PlayerColor = PlayerColor.Red; i < playerCount; i++) {
            this.addChild(new Exile(PlayerColor[i] as keyof typeof PlayerColor));
            this.order.push(i);
        }

        this.board = this.addChild(new OathBoard());
        for (let i = RegionKey.Cradle; i <= RegionKey.Hinterland; i++) {
            this.board.addChild(new Region(RegionKey[i] as keyof typeof RegionKey));
        }

        let regionKey: RegionKey = RegionKey.Cradle;
        const siteKeys: string[] = [];
        for (const siteData of gameData.sites) {
            const siteId = siteData.name;
            siteKeys.push(siteId);
            const region = this.board.byClass(Region).byId(regionKey)[0]!;
            const site = region.addChild(new Site(siteId));
            site.facedown = siteData.facedown;
            if (!site.facedown) site.setupResources();

            for (const denizenOrRelicData of siteData.cards) {
                const cardId = denizenOrRelicData.name;
                if (cardId in denizenData) {
                    const card = new Denizen(cardId);
                    site.addChild(card).reveal();
                    continue;
                }

                if (cardId in edificeData) {
                    const card = new Edifice(cardId);
                    site.addChild(card).reveal();
                    continue;
                }

                if (cardId in relicsData) {
                    site.addChild(new Relic(cardId));
                    continue;
                }
                
                console.warn("Couldn't load " + cardId + " for " + siteId);
            }

            if (region.byClass(Site).length >= region.size) regionKey++;
        }
        
        const regions = this.board.byClass(Region);
        for (const region of regions) {
            const fromBottom = this.worldDeck.drawSingleCard(true);
            if (fromBottom) region.discard.addChild(fromBottom);
        }
        const topCradleSite = regions.byId(RegionKey.Cradle)[0]?.byClass(Site)[0]!;

        const players = this.byClass(OathPlayer);
        for (const player of players) {
            player.putResources(Favor, player === this.chancellor ? 2 : 1);
            player.putResources(Secret, 1);
            player.leader.bag.moveChildrenTo(player, 3);

            new DrawFromDeckEffect(player, this.worldDeck, 3, true).doNext(cards => {
                if (player !== this.chancellor)
                    new ChooseSitesAction(
                        player, "Put your pawn at a faceup site (Hand: " + cards.map(e => e.name).join(", ") + ")",
                        (sites: Site[]) => { if (sites[0]) new PutPawnAtSiteEffect(player, sites[0]).doNext(); }
                    ).doNext();
                else
                    new PutPawnAtSiteEffect(player, topCradleSite).doNext();
                
                new SetupChooseAction(player, cards).doNext();
            });
        }

        this.grandScepter = new GrandScepter();
        this.chancellor.addChild(this.grandScepter).reveal();

        for (const site of this.board.sites()) 
            if (site !== topCradleSite && site.byClass(Denizen).filter(e => e.suit !== OathSuit.None).length)
                this.chancellor.bag.moveChildrenTo(site, 1);
        this.chancellor.bag.moveChildrenTo(topCradleSite, 3);
        
        const startingAmount = playerCount < 5 ? 3 : 4;
        for (let i = OathSuit.Discord; i <= OathSuit.Nomad; i++) {
            const bank = this.addChild(new FavorBank(OathSuit[i] as keyof typeof OathSuit));
            bank.putResources(Favor, startingAmount);
        }

        this.oath = new OathTypeToOath[OathType[gameData.oath] as keyof typeof OathType]();
        this.chancellor.addChild(this.oath).setup();

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
            
            if (hasPowers(node) && node.active)
                for (const power of node.powers)
                    if (isExtended(power, type)) powers.push([node, power]);
        }

        return powers;
    }

    gatherModifiers<T extends ModifiableAction>(action: T, activator: OathPlayer): Set<ActionModifier<WithPowers, T>> {
        const instances = new Set<ActionModifier<WithPowers, T>>();
        for (const [sourceProxy, modifier] of action.gameProxy.getPowers(ActionModifier<WithPowers, T>)) {
            const instance = new modifier(sourceProxy.original, action, activator);
            if (action instanceof instance.modifiedAction && instance.canUse()) instances.add(instance);
        }

        return instances;
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
                    new SetUsurperEffect(this, false).doNext();
                    new SetNewOathkeeperEffect(targets[0]).doNext();
                }
            ).doNext();
    }

    empireWins() {
        const candidates = this.oath.getSuccessorCandidates();
        if (candidates.has(this.chancellor)) return new WinGameEffect(this.chancellor).doNext();

        new ChoosePlayersAction(
            this.chancellor, "Choose a Successor",
            (targets: OathPlayer[]) => { if (targets[0]) new WinGameEffect(targets[0]).doNext(); },
            [[...candidates].filter(e => e instanceof Exile && e.isCitizen)]
        ).doNext();
    }

    serialize(): Record<string, any> {
        return {
            ...super.serialize(),
            name: this.name,
            chronicleNumber: this.chronicleNumber,
            oathkeeper: this.oathkeeper.id,
            isUsurper: this.isUsurper,
            currentPlayer: this.currentPlayer.id,
            turn: this.turn,
            phase: this.phase,
            round: this.round,
            order: this.order,
            seed: this.seed
        }
    }

    parse(obj: Record<string, any>, allowCreation: boolean = false) {
        super.parse(obj, allowCreation);
        this.name = obj.name;
        this.chronicleNumber = obj.chronicleNumber;
        this.isUsurper = obj.isUsurper;
        this.turn = obj.turn;
        this.phase = obj.phase;
        this.round = obj.round;
        this.order = obj.order;
        this.seed = obj.seed;
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

