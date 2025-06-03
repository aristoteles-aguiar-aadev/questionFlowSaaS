import { ItemValue, QuestionCommentModel } from "survey-core";
import { PropertyEditorSetupValue } from "./index";
import { ISurveyCreatorOptions } from "../creator-settings";
export declare class FastEntryEditorBase extends PropertyEditorSetupValue {
    choices: Array<any>;
    protected className: string;
    protected names: Array<string>;
    protected commentValue: QuestionCommentModel;
    constructor(choices: Array<any>, options?: ISurveyCreatorOptions, className?: string, names?: Array<string>);
    protected calcBeforeApplyItemsArray(dest: Array<any>, src: Array<any>, names: Array<string>): void;
    applyItemValueArray(dest: Array<any>, src: Array<any>, names?: Array<string>): void;
    protected getSurveyJSON(): any;
    protected getSurveyCreationReason(): string;
    apply(): boolean;
    protected applyCore(): boolean;
    protected convertTextToItemValues(texts: Array<string>): ItemValue[];
    get comment(): QuestionCommentModel;
    protected getChoicesCount(): number;
    protected get isValueUnique(): boolean;
    protected getFirstUniqueValue(): boolean;
    setComment(): void;
    protected collectNames(item: any, type: string, separatorCounter: number): string;
    protected convertItemValuesToText(): string;
}
export declare class FastEntryEditor extends FastEntryEditorBase {
    choices: Array<ItemValue>;
    protected className: string;
    protected names: Array<string>;
    constructor(choices: Array<ItemValue>, options?: ISurveyCreatorOptions, className?: string, names?: Array<string>);
    apply(): boolean;
    applyItemValueArray(dest: Array<ItemValue>, src: Array<ItemValue>, names?: Array<string>): void;
    protected convertItemValuesToText(): string;
}
