import type { i18n, TOptions } from 'i18next';
import { useTranslation as useReactI18nextTranslation } from 'react-i18next';
import type {
  WarChestNamespace,
  WarChestResources,
  WarChestTranslationParameters,
} from './__generated__/WarChestResources';

interface TranslationResponse<
  Namespace extends WarChestNamespace,
  KeyPrefix extends WarChestKeyPrefix<Namespace>,
> {
  i18n: i18n;
  ready: boolean;
  t: WarChestTFunction<Namespace, KeyPrefix>;
}

interface RuntimeTranslationResponse {
  i18n: i18n;
  ready: boolean;
  t: unknown;
}

interface RuntimeTranslationHook {
  (
    namespace: string,
    options: TranslationOptions<string>
  ): RuntimeTranslationResponse;
}

type WarChestKeyPrefix<Namespace extends WarChestNamespace> =
  keyof WarChestResources[Namespace] & string;

type TranslationContractKey = keyof WarChestTranslationParameters;

type ExtractTranslationKey<
  ContractKey extends string,
  Namespace extends WarChestNamespace,
  KeyPrefix extends string,
> = ContractKey extends `${Namespace}.${KeyPrefix}.${infer Key}` ? Key : never;

type TranslationKey<
  Namespace extends WarChestNamespace,
  KeyPrefix extends string,
> = ExtractTranslationKey<TranslationContractKey, Namespace, KeyPrefix>;

type TranslationPath<
  Namespace extends WarChestNamespace,
  KeyPrefix extends string,
  Key extends string,
> = `${Namespace}.${KeyPrefix}.${Key}` & keyof WarChestTranslationParameters;

type TranslationParameters<
  Namespace extends WarChestNamespace,
  KeyPrefix extends string,
  Key extends string,
> = WarChestTranslationParameters[TranslationPath<Namespace, KeyPrefix, Key>];

type TranslationArguments<Parameters> = Parameters extends null
  ? [options?: TOptions]
  : [options: TOptions & Parameters];

interface WarChestTFunction<
  Namespace extends WarChestNamespace,
  KeyPrefix extends string,
> {
  <Key extends TranslationKey<Namespace, KeyPrefix>>(
    key: Key,
    ...arguments_: TranslationArguments<
      TranslationParameters<Namespace, KeyPrefix, Key>
    >
  ): string;
}

interface TranslationOptions<KeyPrefix extends string> {
  keyPrefix: KeyPrefix;
}

export function useTranslation<
  const Namespace extends WarChestNamespace,
  const KeyPrefix extends WarChestKeyPrefix<Namespace>,
>(
  namespace: Namespace,
  options: TranslationOptions<KeyPrefix>
): TranslationResponse<Namespace, KeyPrefix> {
  const useRuntimeTranslation =
    useReactI18nextTranslation as unknown as RuntimeTranslationHook;
  const {
    i18n: i18nInstance,
    ready,
    t,
  } = useRuntimeTranslation(namespace, options);
  const translate = t as WarChestTFunction<Namespace, KeyPrefix>;

  return { i18n: i18nInstance, ready, t: translate };
}
