import { Action } from "survey-core";
import { SurveyCreatorModel } from "../../creator-base";
import { ICreatorPlugin } from "../../creator-settings";
import { SurveyLogicUI } from "./logic-ui";
export declare class TabLogicPlugin implements ICreatorPlugin {
    private creator;
    private filterQuestionAction;
    private filterActionTypeAction;
    private fastEntryAction;
    model: SurveyLogicUI;
    constructor(creator: SurveyCreatorModel);
    activate(): void;
    private createFilterTypeTitleUpdater;
    private createFilterQuestionTitleUpdater;
    update(): void;
    canDeactivateAsync(onSuccess: () => void): void;
    deactivate(): boolean;
    dispose(): void;
    private disposeObjs;
    createActions(): Action[];
    private get showAllQuestionsText();
    private get showAllActionTypesText();
}
