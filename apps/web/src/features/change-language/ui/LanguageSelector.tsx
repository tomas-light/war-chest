import clsx from 'clsx';
import type { ChangeEvent } from 'react';
import {
  type SupportedLanguage,
  SUPPORTED_LANGUAGES,
} from '#/shared/config/supportedLanguages';
import { useTranslation } from '#/shared/i18n/useTranslation';
import classes from './LanguageSelector.module.scss';

interface Props {
  className?: string;
}

export function LanguageSelector(props: Props) {
  const { className } = props;
  const { i18n, t } = useTranslation('features/change-language', {
    keyPrefix: 'LanguageSelector',
  });
  const selectedLanguage = getSelectedLanguage(i18n.resolvedLanguage);

  return (
    <label className={clsx(classes.selector, className)}>
      <span>{t('label')}</span>
      <select value={selectedLanguage} onChange={handleLanguageChange}>
        {SUPPORTED_LANGUAGES.map((language) => (
          <option key={language} value={language}>
            {language === 'ru' ? t('russian') : t('english')}
          </option>
        ))}
      </select>
    </label>
  );

  function handleLanguageChange(event: ChangeEvent<HTMLSelectElement>): void {
    void i18n.changeLanguage(event.target.value);
  }
}

function getSelectedLanguage(language: string | undefined): SupportedLanguage {
  return language === 'en' ? 'en' : 'ru';
}
