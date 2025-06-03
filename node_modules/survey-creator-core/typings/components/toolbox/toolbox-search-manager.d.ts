import { QuestionToolbox } from "../../toolbox";
import { SearchManager } from "../search-manager";
export declare class SearchManagerToolbox extends SearchManager {
    toolbox: QuestionToolbox;
    protected getFilterStringPlaceholder(): string;
    protected setFiterString(newValue: string, oldValue: string): void;
    clearFilterString(): void;
}
