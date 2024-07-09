import { CardRestriction } from "../enums";
import { AwaitedReturn, Bracken, Curfew, Elders, ForcedLabor, GleamingArmorAttack, GleamingArmorDefense, HeartsAndMinds, InsectSwarmAttack, InsectSwarmDefense, KeyToTheCity, LongbowArchersAttack, LongbowArchersDefense, LostTongue, LostTongueCampaign, OathPower, RelicThief, ShieldWall, SpellBreaker, SpellBreakerActive, TollRoads, WayStation } from "../power";
import { Denizen } from "./cards";

export const denizenData: StringObject<[string, Constructor<OathPower<Denizen>>[], CardRestriction?, boolean?]> = {
    "LongbowArchers": ["Longbow Archers", [LongbowArchersAttack, LongbowArchersDefense]],
    "ShieldWall": ["Shield Wall", [ShieldWall]],
    "Curfew": ["Curfew", [Curfew], CardRestriction.Site],
    "TollRoads": ["Toll Roads", [TollRoads], CardRestriction.Site],
    "ForcedLabor": ["Forced Labor", [ForcedLabor], CardRestriction.Site],

    "GleamingArmor": ["Gleaming Armor", [GleamingArmorAttack, GleamingArmorDefense]],

    "HeartsAndMinds": ["Hearts and Minds", [HeartsAndMinds], CardRestriction.Site],
    "AwaitedReturn": ["AwaitedReturn", [AwaitedReturn]],

    "WayStation": ["Way Station", [WayStation], CardRestriction.Site],
    "LostTongue": ["Lost Tongue", [LostTongue, LostTongueCampaign], CardRestriction.Adviser],
    "Elders": ["Elders", [Elders]],
    "SpellBreaker": ["Spell Breaker", [SpellBreaker, SpellBreakerActive], CardRestriction.Site],

    "RelicThief": ["Relic Thief", [RelicThief]],
    "KeyToTheCity": ["Key to the City", [KeyToTheCity], CardRestriction.Site],

    "Bracken": ["Bracken", [Bracken]],
    "InsectSwarm": ["Insect Swarm", [InsectSwarmAttack, InsectSwarmDefense]]
}