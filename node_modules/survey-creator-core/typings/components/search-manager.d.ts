import { Action, ActionContainer, Base } from "survey-core";
export declare abstract class SearchManager extends Base {
    searchActionBar: ActionContainer;
    get filterStringPlaceholder(): string;
    filterString: string;
    isVisible: boolean;
    matchCounterText: string;
    protected getSearchActions(): Action[];
    initActionBar(): void;
    clearFilterString(): void;
    protected abstract setFiterString(newValue: string, oldValue: string): any;
    protected abstract getFilterStringPlaceholder(): string;
    protected onPropertyValueChanged(name: string, oldValue: any, newValue: any): void;
    constructor();
    dispose(): void;
}
