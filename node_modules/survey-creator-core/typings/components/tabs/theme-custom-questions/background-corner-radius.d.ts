import { JsonObjectProperty } from "survey-core";
export declare function updateBackgroundCornerRadiusJSON(): void;
export declare function backgroundCornerRadiusToCssVariable(value: any, property: JsonObjectProperty, themeCssVariables: {
    [index: string]: string;
}): void;
export declare function backgroundCornerRadiusFromCssVariable(property: JsonObjectProperty, themeCssVariables: {
    [index: string]: string;
}, defaultBackcolorVariableName: string, defaultHovercolorVariableName: string, defaultCornerRadius?: number): any;
