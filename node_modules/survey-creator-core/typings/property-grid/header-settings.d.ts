import { Base, JsonObjectProperty, Question } from "survey-core";
import { PropertyGridEditor } from "./index";
import { ISurveyPropertyGridDefinition } from "../question-editor/definition";
import { ISurveyCreatorOptions } from "../creator-settings";
export declare class PropertyGridEditorQuestionHeader extends PropertyGridEditor {
    fit(prop: JsonObjectProperty): boolean;
    getJSON(obj: Base, prop: JsonObjectProperty, options: ISurveyCreatorOptions): any;
    onCreated(obj: Base, question: Question, prop: JsonObjectProperty, options: ISurveyCreatorOptions, propGridDefinition?: ISurveyPropertyGridDefinition): void;
}
