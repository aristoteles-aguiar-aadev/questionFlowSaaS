import { ICreatorPreset, CreatorPresetBase } from "./presets-base";
import { SurveyCreatorModel } from "../creator-base";
export declare class CreatorPresetPropertyGridDefinition extends CreatorPresetBase {
    getPath(): string;
    protected applyCore(creator: SurveyCreatorModel): void;
}
export declare class CreatorPresetPropertyGrid extends CreatorPresetBase {
    getPath(): string;
    protected createPresets(): Array<ICreatorPreset>;
}
