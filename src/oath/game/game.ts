import { ChoosePlayersAction, SetupChooseAction, WakeAction, ChooseSitesAction } from "./actions/actions";
import { InvalidActionResolution, ModifiableAction } from "./actions/base";
import { HistoryNode, OathActionManager } from "./actions/manager";
import { BecomeCitizenEffect, DrawFromDeckEffect, PutPawnAtSiteEffect, SetNewOathkeeperEffect, SetUsurperEffect, WinGameEffect } from "./actions/effects";
import { ActionModifier, OathPower } from "./powers/powers";
import { OathBoard, Region } from "./board";
import { Discard, RelicDeck, WorldDeck } from "./cards/decks";
import { denizenData, edificeFlipside } from "./cards/denizens";
import { relicsData } from "./cards/relics";
import { OathPhase, OathSuit, RegionKey, PlayerColor, ALL_OATH_SUITS, BannerKey } from "./enums";
import { Oath } from "./oaths";
import { Conspiracy, Denizen, Edifice, GrandScepter, Relic, Site, Vision, WorldCard } from "./cards/cards";
import { Chancellor, Exile, OathPlayer, VisionSlot, WarbandsSupply } from "./player";
import { Banner, DarkestSecret, FavorBank, PeoplesFavor } from "./banks";
import { AbstractConstructor, Constructor, isExtended, PRNG, TreeNode, TreeRoot } from "./utils";
import { parseOathTTSSavefileString, serializeOathGame } from "./parser";
import { Citizenship, PlayerCitizenship } from "./parser/interfaces";
import { hasPowers, SourceType, WithPowers } from "./interfaces";
import { Favor, OathWarband, Secret } from "./resources";
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
    order: PlayerColor[] = [PlayerColor.Purple];

    // References for quick access to static elements
    actionManager = new OathActionManager(this);
    chancellor: Chancellor;
    worldDeck: WorldDeck;
    relicDeck: RelicDeck;
    board: OathBoard;
    grandScepter: GrandScepter;
    banners = new Map<BannerKey, Banner>;

    archive: Set<string>;
    dispossessed: Set<string>;
    oldCitizenship: PlayerCitizenship;

    constructor(public gameId: number, public setupData: [string, number]) {
        super();
        this.setup(setupData);
    }
    
    setup([seed, playerCount]: this["setupData"]) {
        this.seed = seed;
        this.random = new PRNG();

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

        this.chancellor = this.addChild(new Chancellor());
        this.chancellor.reliquary = this.chancellor.addChild(new Reliquary());
        for (let i = 0; i < 4; i++)
            this.chancellor.reliquary.addChild(new ReliquarySlot(String(i))).getRelic();

        for (let i: PlayerColor = PlayerColor.Red; i < playerCount; i++) {
            const id = PlayerColor[i] as keyof typeof PlayerColor;
            const exile = this.addChild(new Exile(id));
            exile.visionSlot = exile.addChild(new VisionSlot(id));
            this.order.push(i);
        }
        this.oldCitizenship = gameData.playerCitizenship;

        this.board = this.addChild(new OathBoard());
        for (let i = RegionKey.Cradle; i <= RegionKey.Hinterland; i++) {
            const id = RegionKey[i] as keyof typeof RegionKey;
            const region = this.board.addChild(new Region(id));
            region.discard = this.addChild(new Discard(id));
        }

        let regionKey: RegionKey = RegionKey.Cradle;
        const siteKeys: string[] = [];
        for (const siteData of gameData.sites) {
            const siteId = siteData.name;
            siteKeys.push(siteId);
            const region = this.board.byClass(Region).byKey(regionKey)[0]!;
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

        const regions = this.board.children;
        for (const region of regions) {
            const fromBottom = this.worldDeck.drawSingleCard(true);
            if (fromBottom) region.discard.addChild(fromBottom);
        }
        const topCradleSite = regions.byKey(RegionKey.Cradle)[0]!.byClass(Site)[0]!;

        const players = this.byClass(OathPlayer);
        for (const player of players) {
            player.bag = player.addChild(new WarbandsSupply(player.id));
            for (let i = 0; i < player.bagAmount; i++) player.bag.addChild(new OathWarband().colorize(player.key));

            player.putResources(Favor, player === this.chancellor ? 2 : 1);
            player.putResources(Secret, 1);
            player.leader.bag.moveChildrenTo(player, 3);
        }

        this.grandScepter = new GrandScepter();
        this.chancellor.addChild(this.grandScepter).turnFaceup();

        for (const site of this.board.sites())
            if (site !== topCradleSite && site.byClass(Denizen).filter(e => e.suit !== OathSuit.None).length)
                this.chancellor.bag.moveChildrenTo(site, 1);
        this.chancellor.bag.moveChildrenTo(topCradleSite, 3);

        const startingAmount = this.players.length < 5 ? 3 : 4;
        for (let i = OathSuit.Discord; i <= OathSuit.Nomad; i++) {
            const bank = this.addChild(new FavorBank(OathSuit[i] as keyof typeof OathSuit));
            Favor.putOn(bank, startingAmount);
        }

        this.oath = new Oath().setType(gameData.oath);
        this.chancellor.addChild(this.oath).setup();

        this.initialActions();
    }
    
    initialActions() {
        for (const player of this.players) {
            if (player.key === PlayerColor.Purple) continue;
            if (this.oldCitizenship[player.key] === Citizenship.Citizen) new BecomeCitizenEffect(player).doNext();
        }

        const topCradleSite = this.board.children.byKey(RegionKey.Cradle)[0]!.byClass(Site)[0]!;
        for (const player of this.players) {
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

        new WakeAction(this.currentPlayer).doNext();
        this.actionManager.history.push(new HistoryNode(this.actionManager, this.serialize(true)));
    }

    get players() { return this.byClass(OathPlayer); }
    get currentPlayer() { return this.players.byKey(this.order[this.turn]!)[0]!; }
    get oathkeeper() { return this.oath.owner ?? this.chancellor; }

    favorBank(suit: OathSuit) {
        return this.byClass(FavorBank).byKey(suit)[0];
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

    startAction(playerColor: keyof typeof PlayerColor, actionName: string) {
        const by = PlayerColor[playerColor];
        if (this.turn !== by) throw new InvalidActionResolution(`Cannot begin an action outside your turn`);
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
            [[...candidates].filter(e => e instanceof Exile && e.isCitizen)]
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
            _oathkeeper: this.oathkeeper.key,
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
            if (player.key === PlayerColor.Purple) continue;
            newCitizenship[player.key] = player.isImperial ? Citizenship.Citizen : Citizenship.Exile
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
            sites: [...this.board.sites()].map(e => ({ name: e.name, facedown: e.facedown, cards: [...e.denizens, ...times(3 - e.denizens.length - e.relics.length, constant({ name: "NONE" })), ...e.relics].map(e => ({ name: e.name })) })),
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
