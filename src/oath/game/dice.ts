export abstract class Die {
    static readonly faces: number[];

    static roll(amount: number): number[] {
        const result: number[] = [];
        for (let i = 0; i < amount; i++) {
            result.push(this.faces[Math.floor(Math.random() * this.faces.length)]);
        }
        return result;
    }

    static getResult(faces: number[]): number {
        let total = 0;
        for (const value of faces) total += value;
        return Math.floor(total);
    }
}

export class AttackDie extends Die {
    static readonly faces = [0.5, 0.5, 0.5, 1, 1, 2];

    static getSkulls(faces: number[]): number {
        let total = 0;
        for (const value of faces) total += (value === 2 ? 1 : 0);
        return Math.floor(total);
    }
}

export class DefenseDie extends Die {
    static readonly faces = [0, 0, 1, 1, 2, -1];

    static getResult(faces: number[]): number {
        let total = 0, mult = 1;
        for (const roll of faces) {
            if (roll == -1)
                mult *= 2;
            else
                total += roll
        }
        return total * mult;
    }
}

export class D6 extends Die {
    static readonly faces = [1, 2, 3, 4, 5, 6];
}