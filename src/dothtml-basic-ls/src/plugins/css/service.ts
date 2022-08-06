import {
    getCSSLanguageService,
    getSCSSLanguageService,
    getLESSLanguageService,
    LanguageService,
    LanguageServiceOptions
} from 'vscode-css-languageservice';


export function getLanguage(kind?: string) {
    switch (kind) {
        case 'scss':
        case 'text/scss':
            return 'scss' as const;
        case 'less':
        case 'text/less':
            return 'less' as const;
        case 'css':
        case 'text/css':
        default:
            return 'css' as const;
    }
}

export type CSSLanguageServices = Record<'css' | 'less' | 'scss', LanguageService>;

export function getLanguageService(langs: CSSLanguageServices, kind?: string): LanguageService {
    const lang = getLanguage(kind);
    return langs[lang];
}

export function createLanguageServices(options?: LanguageServiceOptions): CSSLanguageServices {
    const [css, less, scss] = [
        getCSSLanguageService,
        getLESSLanguageService,
        getSCSSLanguageService
    ].map((getService) =>
        getService({
            customDataProviders: [],
            ...(options ?? {})
        })
    );

    return {
        css,
        less,
        scss
    };
}
