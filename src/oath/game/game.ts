import { ChoosePlayersAction, SetupChooseAdviserAction, WakeAction, ChooseSitesAction, ChooseTsAction, SetupChoosePlayerBoardAction } from "./actions/actions";
import { InvalidActionResolution, ModifiableAction, ResolveCallbackEffect } from "./actions/base";
import { HistoryNode, OathActionManager } from "./actions/manager";
import { BecomeCitizenEffect, DrawFromDeckEffect, PutPawnAtSiteEffect, SetNewOathkeeperEffect, SetUsurperEffect, WinGameEffect } from "./actions/effects";
import { ActionModifier, OathPower } from "./powers/powers";
import { OathMap, Region } from "./map";
import { Discard, RelicDeck, WorldDeck } from "./cards/decks";
import { denizenData, edificeFlipside } from "./cards/denizens";
import { relicsData } from "./cards/relics";
import { OathPhase, OathSuit, RegionKey, PlayerColor, ALL_OATH_SUITS, BannerKey } from "./enums";
import { Oath } from "./oaths";
import { Conspiracy, Denizen, Edifice, GrandScepter, Relic, Site, Vision, WorldCard } from "./cards/cards";
import { ExileBoard, OathPlayer, WarbandsSupply } from "./player";
import { Banner, DarkestSecret, FavorBank, PeoplesFavor } from "./banks";
import { AbstractConstructor, Constructor, isExtended, MurmurHash3, PRNG, TreeNode, TreeRoot } from "./utils";
import { parseOathTTSSavefileString, serializeOathGame } from "./parser";
import { Citizenship, PlayerCitizenship } from "./parser/interfaces";
import { hasPowers, SourceType, WithPowers } from "./interfaces";
import { Favor, Warband, Secret } from "./resources";
import { Reliquary, ReliquarySlot } from "./reliquary";
import classIndex from "./classIndex";
import { constant, times } from "lodash";
import * as fs from "fs";


export class OathGame extends TreeRoot<OathGame> {
    type = "root";
    classIndex = classIndex;

    random: PRNG;

    seed: string;
    name: string;
    chronicleNumber: number;
    oath: Oath;
    isUsurper = false;

    turn = 0;
    phase = OathPhase.Act;
    round = 1;
    order: number[] = [];

    // References for quick access to static elements
    actionManager = new OathActionManager(this);
    chancellor: OathPlayer;
    reliquary: Reliquary;
    worldDeck: WorldDeck;
    relicDeck: RelicDeck;
    map: OathMap;
    grandScepter: GrandScepter;
    banners = new Map<BannerKey, Banner>;

    archive: Set<string>;
    dispossessed: Set<string>;
    oldCitizenship: PlayerCitizenship;

    constructor(public gameId: number, public setupData: [string, string[]]) {
        super();
        this.setup(setupData);
    }
    
    setup([seed, playerNames]: this["setupData"]) {
        this.seed = seed;
        this.random = new PRNG(MurmurHash3(this.seed));

        this.worldDeck = this.addChild(new WorldDeck());
        this.relicDeck = this.addChild(new RelicDeck());
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

        this.archive = new Set(Object.keys(denizenData));
        this.dispossessed = new Set();

        for (const cardData of gameData.dispossessed) {
            this.archive.delete(cardData.name);
            this.dispossessed.add(cardData.name);
        }

        for (const cardData of gameData.world) {
            const existing = this.archive.delete(cardData.name);
            if (existing) {
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

        for (const [i, name] of playerNames.entries()) {
            const player = this.addChild(new OathPlayer(String(i)));
            player.name = name;
        }
        this.oldCitizenship = gameData.playerCitizenship;

        this.reliquary = this.addChild(new Reliquary());
        for (let i = 0; i < 4; i++) this.reliquary.addChild(new ReliquarySlot(String(i))).getRelic();

        this.map = this.addChild(new OathMap());
        for (let i = RegionKey.Cradle; i <= RegionKey.Hinterland; i++) {
            const id = RegionKey[i] as keyof typeof RegionKey;
            const region = this.map.addChild(new Region(id));
            region.discard = this.addChild(new Discard(id));
        }

        let regionKey: RegionKey = RegionKey.Cradle;
        const siteKeys: string[] = [];
        for (const siteData of gameData.sites) {
            const siteId = siteData.name;
            siteKeys.push(siteId);
            const region = this.map.byClass(Region).byKey(regionKey)[0]!;
            const site = region.addChild(new Site(siteId));
            site.facedown = siteData.facedown;
            if (!site.facedown) site.setupResources();

            for (const denizenOrRelicData of siteData.cards) {
                const cardId = denizenOrRelicData.name;
                if (cardId in denizenData) {
                    const card = cardId in edificeFlipside ? new Edifice(cardId) : new Denizen(cardId);
                    site.addChild(card).turnFaceup();
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
        
        this.grandScepter = new GrandScepter();
        this.oath = new Oath().setType(gameData.oath);

        this.initialActions();
    }
    
    initialActions() {
        for (const player of this.players) {
            new SetupChoosePlayerBoardAction(player).doNext();
        }

        new ResolveCallbackEffect(this, () => {
            if (!this.chancellor) throw new InvalidActionResolution("The Chancellor is in every game and demands your respect!");
            
            this.order = [];
            for (const player of this.players) {
                player.bag = player.addChild(new WarbandsSupply(player.board.id));
                for (let i = 0; i < player.board.bagAmount; i++) player.bag.addChild(new Warband().colorize(player.board.key));
                if (player !== this.chancellor) this.order.push(player.key);
            }
            this.random.shuffleArray(this.order);
            this.order.unshift(this.chancellor.key);
            
            for (const player of this.players) {
                player.board.putResources(Favor, player === this.chancellor ? 2 : 1);
                player.board.putResources(Secret, 1);
                player.leader.bag.moveChildrenTo(player.board, 3);
                new DrawFromDeckEffect(player, this.worldDeck, 3, true).doNext(cards => {
                    if (player !== this.chancellor)
                        new ChooseSitesAction(
                            player, "Put your pawn at a faceup site (Hand: " + cards.map(e => e.name).join(", ") + ")",
                            (sites: Site[]) => { if (sites[0]) new PutPawnAtSiteEffect(player, sites[0]).doNext(); }
                        ).doNext();
                    else
                        new PutPawnAtSiteEffect(player, topCradleSite).doNext();
                
                    new SetupChooseAdviserAction(player, cards).doNext();
                });
            }

            const topCradleSite = this.map.children.byKey(RegionKey.Cradle)[0]!.byClass(Site)[0]!;
            this.chancellor.bag.moveChildrenTo(topCradleSite, 3);
            for (const site of this.map.sites())
                if (site !== topCradleSite && site.byClass(Denizen).filter(e => e.suit !== OathSuit.None).length)
                    this.chancellor.bag.moveChildrenTo(site, 1);

            this.chancellor.addChild(this.grandScepter).turnFaceup();
            this.chancellor.addChild(this.oath).setup();
            this.chancellor.addChild(this.reliquary);

            new WakeAction(this.currentPlayer).doNext();
        }).doNext();  

        this.actionManager.history.push(new HistoryNode(this.actionManager, this.serialize(true)));
    }

    get players() {
        const unordered = this.byClass(OathPlayer);
        return this.order ? unordered.sort((a, b) => this.order.indexOf(a.key) - this.order.indexOf(b.key)) : unordered;
    }
    private get currentId() { return this.order[this.turn]; }
    get currentPlayer() { return this.currentId !== undefined ? this.players.byKey(this.currentId)[0]! : this.players[0]!; }
    get oathkeeper() { return this.oath.owner ?? this.chancellor; }

    favorBank(suit: OathSuit) {
        return this.byClass(FavorBank).byKey(suit)[0];
    }

    *getPowers<T extends OathPower<WithPowers>>(type: AbstractConstructor<T>): Generator<[SourceType<T>, Constructor<T>]> {
        let stack: TreeNode<any>[] = [...this.children];
        while (stack.length) {
            const node = stack.pop()!;
            for (const child of node.children)
                stack.push(child);

            if (hasPowers(node) && node.active)
                for (const power of node.powers)
                    if (isExtended(power, type))
                        yield [node as SourceType<T>, power];
        }
    }

    gatherModifiers<T extends ModifiableAction>(action: T, activator: OathPlayer): Set<ActionModifier<WithPowers, T>> {
        const instances = new Set<ActionModifier<WithPowers, T>>();
        for (const [sourceProxy, modifier] of action.gameProxy.getPowers(ActionModifier<WithPowers, T>)) {
            const instance = new modifier(sourceProxy.original, action, activator);
            if (action instanceof instance.modifiedAction && instance.canUse()) instances.add(instance);
        }

        return instances;
    }

    startAction(playerId: string, actionName: string) {
        if (this.currentPlayer.id !== playerId) throw new InvalidActionResolution(`Cannot begin an action outside your turn`);
        if (this.phase !== OathPhase.Act) throw new InvalidActionResolution(`Cannot begin an action outside the Act phase`);
        if (this.actionManager.actionsStack.length) throw new InvalidActionResolution("Cannot start an action while other actions are active");

        return this.actionManager.startAction(actionName);
    }

    stackEmpty() {
        if (this.phase === OathPhase.Over) {
            this.archiveSave();
        } else {
            this.checkForOathkeeper();
        }
    }

    checkForOathkeeper() {
        const candidates = this.oath.getOathkeeperCandidates();
        if (candidates.has(this.oathkeeper)) return;
        if (candidates.size) {
            new ChoosePlayersAction(
                this.oathkeeper, "Choose the new Oathkeeper",
                (targets: OathPlayer[]) => {
                    if (!targets[0]) return;
                    new SetUsurperEffect(this, false).doNext();
                    new SetNewOathkeeperEffect(targets[0]).doNext();
                },
                [candidates]
            ).doNext();
        }
    }

    empireWins() {
        const candidates = this.oath.getSuccessorCandidates();
        if (candidates.has(this.chancellor)) return new WinGameEffect(this.chancellor).doNext();

        new ChoosePlayersAction(
            this.chancellor, "Choose a Successor",
            (targets: OathPlayer[]) => { if (targets[0]) new WinGameEffect(targets[0]).doNext(); },
            [[...candidates].filter(e => e.board instanceof ExileBoard && e.isImperial)]
        ).doNext();
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
            oath: this.oath.oathType,
            suitOrder: ALL_OATH_SUITS,
            sites: [...this.map.sites()].map(e => ({ name: e.name, facedown: e.facedown, cards: [...e.denizens, ...times(3 - e.denizens.length - e.relics.length, constant({ name: "NONE" })), ...e.relics].map(e => ({ name: e.name })) })),
            world: this.worldDeck.children.map(e => ({ name: e.name })),
            dispossessed: [...this.dispossessed].map(e => ({ name: e })),
            relics: this.relicDeck.children.map(e => ({ name: e.name })),

            prevPlayerCitizenship: this.oldCitizenship,
            winner: winner
        });
    }

    stringify() {
        return JSON.stringify(this.setupData) + "\n\n" + this.actionManager.history.map(e => e.stringify()).join("\n\n");
    }

    get savePath() { return "data/oath/save" + this.gameId + ".txt"; }
    get archivePath() { return "data/oath/replay" + Date.now() + ".txt"; }

    save() {
        const data = this.stringify();
        fs.writeFileSync(this.savePath, data);
    }

    archiveSave() {
        const data = this.stringify() + "\n\n" + JSON.stringify([this.seed]);
        fs.writeFileSync(this.archivePath, data);
        fs.rmSync(this.savePath)
    }

    static load(gameId: number, data: string) {
        const chunks = data.split('\n\n');
        const setupData = JSON.parse(chunks.shift()!);
        const game = new this(gameId, setupData);
        game.actionManager.checkForNextAction();  // Flush the initial actions onto the stack

        for (const [i, nodeData] of chunks.entries()) {
            // console.log(`Resolving chunk ${i}`);
            const node = new HistoryNode(game.actionManager, game.serialize(true));
            node.parse(nodeData);
        }

        return game;
    }
}
