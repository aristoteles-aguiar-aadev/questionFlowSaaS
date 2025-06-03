import { Base, ActionContainer } from "survey-core";
import { IQuestionToolboxItem, QuestionToolboxItem } from "../../toolbox";
import { SurveyCreatorModel } from "../../creator-base";
export declare class ToolboxToolViewModel extends Base {
    protected item: IQuestionToolboxItem;
    protected creator: SurveyCreatorModel;
    protected model: ActionContainer;
    private dragOrClickHelper;
    constructor(item: IQuestionToolboxItem, creator: SurveyCreatorModel, model: ActionContainer);
    click: (event: any) => void;
    get toolboxItem(): QuestionToolboxItem;
    get itemComponent(): string;
    get allowAdd(): boolean;
    onMouseOver(itemValue: any, mouseoverEvent: any): void;
    onMouseLeave(itemValue: any, mouseoverEvent: any): void;
    onPointerDown(pointerDownEvent: any): boolean;
    private onPointerUp;
    private startDragToolboxItem;
    private isDotsItem;
    private hidePopup;
    private get dragDropHelper();
}
