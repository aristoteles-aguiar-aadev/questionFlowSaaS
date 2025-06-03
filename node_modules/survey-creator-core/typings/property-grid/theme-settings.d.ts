import { Base, JsonObjectProperty, Question } from "survey-core";
import { PropertyGridEditor } from ".";
import { ISurveyCreatorOptions } from "../creator-settings";
export declare class PropertyGridEditorFontSettings extends PropertyGridEditor {
    fit(prop: JsonObjectProperty): boolean;
    getJSON(obj: Base, prop: JsonObjectProperty, options: ISurveyCreatorOptions): any;
    onCreated(obj: Base, question: Question, prop: JsonObjectProperty): void;
}
export declare class PropertyGridEditorBackgroundCornerRadius extends PropertyGridEditor {
    fit(prop: JsonObjectProperty): boolean;
    getJSON(obj: Base, prop: JsonObjectProperty, options: ISurveyCreatorOptions): any;
    onCreated(obj: Base, question: Question, prop: JsonObjectProperty): void;
}
export declare class PropertyGridEditorShadowEffects extends PropertyGridEditor {
    fit(prop: JsonObjectProperty): boolean;
    getJSON(obj: Base, prop: JsonObjectProperty, options: ISurveyCreatorOptions): any;
}
