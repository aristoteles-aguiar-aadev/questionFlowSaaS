import { ICreatorPreset, CreatorPresetBase } from "./presets-base";
import { SurveyCreatorModel } from "../creator-base";
export interface ICreatorPresetToolboxItem {
    name: string;
    iconName?: string;
    json?: any;
    title?: string;
    tooltip?: string;
}
export declare class CreatorPresetToolboxDefinition extends CreatorPresetBase {
    getPath(): string;
    protected applyCore(creator: SurveyCreatorModel): void;
    private applyDefinition;
    private getPresetDefaultItems;
}
export declare class CreatorPresetToolboxConfigurator extends CreatorPresetBase {
    getPath(): string;
    protected applyCore(creator: SurveyCreatorModel): void;
    private applyItems;
    private applyCategories;
}
export declare class CreatorPresetToolbox extends CreatorPresetBase {
    getPath(): string;
    protected createPresets(): Array<ICreatorPreset>;
}
