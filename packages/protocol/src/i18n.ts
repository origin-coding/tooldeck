export type LocaleCode = string;

export type TranslationKey = string;

export type LocalizedString =
  | string
  | {
      key: TranslationKey;
      default: string;
    };

export type LocaleResourceMap = Partial<Record<LocaleCode, string>>;
