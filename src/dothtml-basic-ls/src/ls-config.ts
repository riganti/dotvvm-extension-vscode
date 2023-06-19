import { get, merge } from 'lodash';
import { UserPreferences } from 'typescript';
import { VSCodeEmmetConfig } from 'vscode-emmet-helper';
import { returnObjectIfHasKeys } from './utils';

/**
 * Default config for the language server.
 */
const defaultLSConfig: LSConfig = {
    css: {
        enable: true,
        globals: '',
        diagnostics: { enable: true },
        hover: { enable: true },
        completions: { enable: true, emmet: true },
        documentColors: { enable: true },
        colorPresentations: { enable: true },
        documentSymbols: { enable: true },
        selectionRange: { enable: true }
    },
    html: {
        enable: true,
        hover: { enable: true },
        completions: { enable: true, emmet: true },
        documentSymbols: { enable: true },
        linkedEditing: { enable: true }
    },
    dotvvm: {
        enable: true,
        codeActions: { enable: true },
        selectionRange: { enable: true },
        completions: { enable: true },
        tagComplete: { enable: true },
        diagnostics: { enable: true },
        hover: { enable: true },
    }
};

/**
 * Representation of the language server config.
 * Should be kept in sync with infos in `packages/dotvvm-vscode/package.json`.
 */
export interface LSConfig {
    css: LSCSSConfig;
    html: LSHTMLConfig;
    dotvvm: LSDotvvmConfig;
}

type Switch = { enable: boolean }

export interface LSCSSConfig {
    enable: boolean;
    globals: string;
    diagnostics: {
        enable: boolean;
    };
    hover: {
        enable: boolean;
    };
    completions: {
        enable: boolean;
        emmet: boolean;
    };
    documentColors: {
        enable: boolean;
    };
    colorPresentations: {
        enable: boolean;
    };
    documentSymbols: {
        enable: boolean;
    };
    selectionRange: {
        enable: boolean;
    };
}

export interface LSHTMLConfig {
    enable: boolean;
    hover: {
        enable: boolean;
    };
    completions: {
        enable: boolean;
        emmet: boolean;
    };
    documentSymbols: {
        enable: boolean;
    };
    linkedEditing: {
        enable: boolean;
    };
}

export type CompilerWarningsSettings = Record<string, 'ignore' | 'error'>;

export interface LSDotvvmConfig {
    enable: boolean
    diagnostics: Switch
    completions: Switch
    tagComplete: Switch
    hover: Switch
    codeActions: Switch
    selectionRange: Switch
}

/**
 * The config as the vscode-css-languageservice understands it
 */
export interface CssConfig {
    validate?: boolean;
    lint?: any;
    completion?: any;
    hover?: any;
}

type DeepPartial<T> = T extends CompilerWarningsSettings
    ? T
    : {
          [P in keyof T]?: DeepPartial<T[P]>;
      };

export class LSConfigManager {
    private config: LSConfig = defaultLSConfig;
    private listeners: Array<(config: LSConfigManager) => void> = [];
    private emmetConfig: VSCodeEmmetConfig = {};
    private cssConfig: CssConfig | undefined;
    private isTrusted = true;

    /**
     * Updates config.
     */
    update(config: DeepPartial<LSConfig>): void {
        this.config = merge({}, defaultLSConfig, this.config, config);

        this.listeners.forEach((listener) => listener(this));
    }

    /**
     * Whether or not specified config is enabled
     * @param key a string which is a path. Example: 'dotvvm.diagnostics.enable'.
     */
    enabled(key: string): boolean {
        return !!this.get(key);
    }

    /**
     * Get specific config
     * @param key a string which is a path. Example: 'dotvvm.diagnostics.enable'.
     */
    get<T>(key: string): T {
        return get(this.config, key);
    }

    /**
     * Get the whole config
     */
    getConfig(): Readonly<LSConfig> {
        return this.config;
    }

    /**
     * Register a listener which is invoked when the config changed.
     */
    onChange(callback: (config: LSConfigManager) => void): void {
        this.listeners.push(callback);
    }

    updateEmmetConfig(config: VSCodeEmmetConfig): void {
        this.emmetConfig = config || {};
        this.listeners.forEach((listener) => listener(this));
    }

    getEmmetConfig(): VSCodeEmmetConfig {
        return this.emmetConfig;
    }

    /**
     * Whether or not the current workspace can be trusted.
     * If not, certain operations should be disabled.
     */
    getIsTrusted(): boolean {
        return this.isTrusted;
    }

    updateIsTrusted(isTrusted: boolean): void {
        this.isTrusted = isTrusted;
        this.listeners.forEach((listener) => listener(this));
    }

    updateCssConfig(config: CssConfig | undefined): void {
        this.cssConfig = config;
        this.listeners.forEach((listener) => listener(this));
    }

    getCssConfig(): CssConfig | undefined {
        return this.cssConfig;
    }
}

export const lsConfig = new LSConfigManager();
