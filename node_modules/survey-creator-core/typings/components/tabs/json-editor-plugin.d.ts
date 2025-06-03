import { Base, ListModel, Action } from "survey-core";
import { SurveyCreatorModel } from "../../creator-base";
import { ICreatorPlugin } from "../../creator-settings";
import { SurveyTextWorkerError } from "../../textWorker";
import { saveToFileHandler } from "../../utils/html-element-utils";
export declare abstract class JsonEditorBaseModel extends Base {
    protected creator: SurveyCreatorModel;
    isJSONChanged: boolean;
    isProcessingImmediately: boolean;
    private static updateTextTimeout;
    private jsonEditorChangedTimeoutId;
    hasErrors: boolean;
    constructor(creator: SurveyCreatorModel);
    get text(): string;
    set text(val: string);
    protected abstract getText(): string;
    protected abstract setText(val: string): void;
    protected onEditorActivated(): void;
    onPluginActivate(): void;
    protected onTextChanged(): void;
    private errorListValue;
    get errorList(): ListModel;
    protected setErrors(errors: Array<SurveyTextWorkerError>): void;
    protected gotoError(at: number, row: number, column: number): void;
    private createErrorActions;
    processErrors(text: string): void;
    get readOnly(): boolean;
}
export declare abstract class TabJsonEditorBasePlugin implements ICreatorPlugin {
    private creator;
    private inputFileElement;
    private importAction;
    private exportAction;
    private copyAction;
    constructor(creator: SurveyCreatorModel);
    saveToFileHandler: typeof saveToFileHandler;
    exportToFile(fileName: string): void;
    importFromFile(file: File, callback?: (json: string) => void): void;
    copyToClipboard(): void;
    protected createActions(): Array<Action>;
    model: JsonEditorBaseModel;
    activate(): void;
    deactivate(): boolean;
    defaultAllowingDeactivate(): boolean;
    protected abstract createModel(creator: SurveyCreatorModel): JsonEditorBaseModel;
}
