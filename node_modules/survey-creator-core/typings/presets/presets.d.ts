import { CreatorPresetBase, ICreatorPreset } from "./presets-base";
import { ICreatorPresetToolboxItem } from "./presets-toolbox";
import { IToolboxCategoryDefinition } from "../toolbox";
import { ISurveyPropertyGridDefinition } from "../question-editor/definition";
import { SurveyCreatorModel } from "../creator-base";
export interface ICreatorPresetData {
    languages?: {
        creator?: string;
        surveyLocales?: Array<string>;
        useEnglishNames?: boolean;
    };
    propertyGrid?: {
        definition?: ISurveyPropertyGridDefinition;
    };
    tabs?: {
        items?: Array<string>;
        activeTab?: string;
    };
    toolbox?: {
        definition?: Array<ICreatorPresetToolboxItem>;
        categories?: Array<IToolboxCategoryDefinition>;
        items?: Array<string>;
        showCategoryTitles?: boolean;
    };
    localization?: any;
}
export declare class CreatorPreset extends CreatorPresetBase {
    constructor(json: ICreatorPresetData);
    getPath(): string;
    getJson(): ICreatorPresetData;
    apply(creator?: SurveyCreatorModel): void;
    protected applyLocalization(): void;
    protected createPresets(): Array<ICreatorPreset>;
}
