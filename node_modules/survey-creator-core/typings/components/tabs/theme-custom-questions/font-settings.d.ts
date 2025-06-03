import { JsonObjectProperty } from "survey-core";
export declare const DefaultFonts: string[];
export declare function updateFontSettingsJSON(): void;
export declare function fontsettingsToCssVariable(value: any, property: JsonObjectProperty, themeCssVariables: {
    [index: string]: string;
}): void;
export declare function fontsettingsFromCssVariable(property: JsonObjectProperty, themeCssVariables: {
    [index: string]: string;
}, defaultColorVariableName?: string, defaultPlaceholderColorVariableName?: string): any;
