import { OathTypeVisionName } from "../enums";
import { OathGame } from "../game";
import { Oath } from "../oaths";
import { ConspiracyPower } from "../powers/visions";
import { WorldCard } from "./base";


export abstract class VisionBack extends WorldCard { }

export class Vision extends VisionBack {
    oath: Oath;

    constructor(oath: Oath) {
        super(oath.game, `Vision of ${OathTypeVisionName[oath.type]}`, []);
        this.oath = oath;
    }

    serialize(): Record<string, any> {
        const obj: Record<string, any> = super.serialize();
        obj.oath = this.oath.type;
        return obj;
    }
}

export class Conspiracy extends VisionBack {
    constructor(game: OathGame) {
        super(game, "Conspiracy", [ConspiracyPower]);
    }
}
