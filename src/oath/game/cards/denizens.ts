import { StringObject } from "../actions";
import { CardRestriction } from "../enums";
import { AwaitedReturn, Bracken, Curfew, Elders, ForcedLabor, GleamingArmorAttack, GleamingArmorDefense, HeartsAndMinds, InsectSwarmAttack, InsectSwarmDefense, KeyToTheCity, LongbowArchersAttack, LongbowArchersDefense, LostTongue, LostTongueCampaign, OathPower, RelicThief, ShieldWall, SpellBreaker, SpellBreakerActive, TollRoads, WayStation } from "../power";

const denizenData: StringObject<[string, Constructor<OathPower<any>>[], boolean?, CardRestriction?]> = {
    "LongbowArchers": ["Longbow Archers", [LongbowArchersAttack, LongbowArchersDefense]],
    "ShieldWall": ["Shield Wall", [ShieldWall]],
    "Curfew": ["Curfew", [Curfew]],
    "TollRoads": ["Toll Roads", [TollRoads]],
    "ForcedLabor": ["Forced Labor", [ForcedLabor]],

    "GleamingArmor": ["Gleaming Armor", [GleamingArmorAttack, GleamingArmorDefense]],

    "HeartsAndMinds": ["Hearts and Minds", [HeartsAndMinds]],
    "AwaitedReturn": ["AwaitedReturn", [AwaitedReturn]],

    "WayStation": ["Way Station", [WayStation]],
    "LostTongue": ["Lost Tongue", [LostTongue, LostTongueCampaign]],
    "Elders": ["Elders", [Elders]],
    "SpellBreaker": ["Spell Breaker", [SpellBreaker, SpellBreakerActive]],

    "RelicThief": ["Relic Thief", [RelicThief]],
    "KeyToTheCity": ["Key to the City", [KeyToTheCity]],

    "Bracken": ["Bracken", [Bracken]],
    "InsectSwarm": ["Insect Swarm", [InsectSwarmAttack, InsectSwarmDefense]]
}