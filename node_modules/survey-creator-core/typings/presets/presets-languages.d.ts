import { CreatorPresetBase } from "./presets-base";
import { SurveyCreatorModel } from "../creator-base";
export declare class CreatorPresetLanguages extends CreatorPresetBase {
    getPath(): string;
    protected applyEmptyJson(): boolean;
    protected applyCore(creator: SurveyCreatorModel): void;
}
