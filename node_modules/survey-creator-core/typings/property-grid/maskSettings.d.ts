import { Base, JsonObjectProperty, Question, PanelModel, InputMaskBase } from "survey-core";
import { PropertyGridEditor } from "./index";
import { ISurveyCreatorOptions } from "../creator-settings";
export declare class PropertyGridEditorQuestionMaskSettings extends PropertyGridEditor {
    private _propertyGrid;
    private _prevMaskType;
    private _previewQuestion;
    fit(prop: JsonObjectProperty): boolean;
    getJSON(obj: Base, prop: JsonObjectProperty, options: ISurveyCreatorOptions): any;
    onCreated(obj: Base, question: Question, prop: JsonObjectProperty, options: ISurveyCreatorOptions): void;
    onValueChanged(obj: Base, prop: JsonObjectProperty, question: Question): void;
    updatePanel(obj: Base, question: Question, prop: JsonObjectProperty): void;
    private updateDateTimeMinMaxInputType;
    updatePreviewQuestion(masksettings: InputMaskBase, panel: PanelModel): void;
}
