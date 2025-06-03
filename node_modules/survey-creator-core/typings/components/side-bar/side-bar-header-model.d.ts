import { AdaptiveActionContainer, Base } from "survey-core";
export declare class SidebarHeaderModel extends Base {
    toolbar: AdaptiveActionContainer;
    title: string;
    subTitle: string;
    componentData: any;
    componentName: string;
    get component(): string;
    get componentModel(): any;
    reset(): void;
}
