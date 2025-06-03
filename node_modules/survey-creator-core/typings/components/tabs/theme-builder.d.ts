import { ITheme } from "survey-core";
import { SurveyCreatorModel } from "../../creator-base";
import { PreviewViewModel } from "./preview";
export declare class ThemeTabViewModel extends PreviewViewModel {
    constructor(surveyProvider: SurveyCreatorModel, startThemeClasses: any);
    get currentTheme(): ITheme;
    get currentThemeCssVariables(): {
        [index: string]: string;
    };
    protected getTabName(): string;
}
