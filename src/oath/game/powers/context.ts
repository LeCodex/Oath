import { clone } from "lodash";
import type { ContextCost, ContextSource, Cost, CostContext } from "../costs";
import type { OathPlayer } from "../model/player";
import type { Factory, MaskProxyManager} from "../utils";
import { allChoices } from "../utils";
import type { OathPowerManager } from "./manager";


export class MultiCostContext<T extends CostContext<Cost>> {
    constructor(
        public powerManager: OathPowerManager,
        public player: OathPlayer,
        public costContexts: T[],
        public dummyFactory: Factory<T, [ContextSource<T>, ContextCost<T>?]>
    ) { }

    payableCostsWithModifiers(maskProxyManager: MaskProxyManager) {
        const payableCostsInfo = this.costContexts.map(e => this.powerManager.payableCostsWithModifiers(e, maskProxyManager));
        return allChoices(payableCostsInfo).map(choice => {
            const context: MultiCostContext<T> = clone(this);
            context.costContexts = choice.map(e => e.context as T);
            if (!context.isValid()) return undefined;
            return { context, modifiers: [] };  // Technically, none of the modifiers are applied to the Multi (and none should, for now)
        }).filter(e => !!e);
    }
    
    isValid(): boolean {
        const totalCostBySource = new Map<ContextSource<T>, ContextCost<T>>();
        for (const costContext of this.costContexts) {
            if (!totalCostBySource.has(costContext.source))
                totalCostBySource.set(costContext.source, this.dummyFactory(costContext.source).cost as ContextCost<T>);
            totalCostBySource.get(costContext.source)!.add(costContext.cost);
        }

        for (const [source, totalCost] of totalCostBySource)
            if (!this.dummyFactory(source, totalCost).isValid())
                return false;

        return true;
    }
}
