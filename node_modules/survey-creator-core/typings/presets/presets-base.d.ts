import { EventBase } from "survey-core";
import { SurveyCreatorModel } from "../creator-base";
export interface ICreatorPreset {
    setJson(json: any): void;
    apply(creator: SurveyCreatorModel): void;
    getPath(): string;
}
export declare abstract class CreatorPresetBase implements ICreatorPreset {
    onApplied: EventBase<CreatorPresetBase, any>;
    children: Array<ICreatorPreset>;
    protected json: any;
    constructor();
    setJson(json: any): void;
    apply(creator?: SurveyCreatorModel): void;
    abstract getPath(): string;
    protected applyEmptyJson(): boolean;
    protected applyCore(creator: SurveyCreatorModel): void;
    protected createPresets(): Array<ICreatorPreset>;
    private setupPresets;
    private addPreset;
    private addPresets;
}
