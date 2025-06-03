import { SurveyCreatorModel } from "../../creator-base";
import { ICreatorPlugin } from "../../creator-settings";
export declare class UndoRedoPlugin implements ICreatorPlugin {
    private creator;
    constructor(creator: SurveyCreatorModel);
    model: any;
    activate(): void;
    deactivate(): boolean;
    update(): void;
    addFooterActions(): void;
}
export declare function undoRedoTransaction(transactionName?: string, undoRedoManagerProperty?: string): (target: any, propertyKey: string, descriptor: PropertyDescriptor) => PropertyDescriptor;
export declare function ignoreUndoRedo(undoRedoManagerProperty?: string): (target: any, propertyKey: string, descriptor: PropertyDescriptor) => PropertyDescriptor;
