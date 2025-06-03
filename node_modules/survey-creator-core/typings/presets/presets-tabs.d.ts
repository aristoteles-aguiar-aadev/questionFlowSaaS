import { CreatorPresetBase } from "./presets-base";
import { SurveyCreatorModel } from "../creator-base";
export declare class CreatorPresetTabs extends CreatorPresetBase {
    getPath(): string;
    protected applyCore(creator: SurveyCreatorModel): void;
    private applyTabs;
}
