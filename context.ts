
import * as React from 'react';
import { i18nStrings, type Language, type TranslationKey } from './pages';

export const LocalizationContext = React.createContext({
  language: 'en' as Language,
  setLanguage: (lang: Language) => {},
  t: (key: TranslationKey, params?: Record<string, any>): string => key as string,
});

export const LocalizationProvider = ({ children }: { children: React.ReactNode }): React.ReactElement => {
  const [language, setLanguage] = React.useState<Language>('fa');

  React.useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'fa' ? 'rtl' : 'ltr';
  }, [language]);

  const t = React.useCallback((key: TranslationKey, params?: Record<string, any>): string => {
    let str = i18nStrings[language][key] || i18nStrings['en'][key] || key;
    if (params) {
      Object.keys(params).forEach(pKey => {
        str = str.replace(`{{${pKey}}}`, params[pKey]);
      });
    }
    return str as string;
  }, [language]);
  
  const value = React.useMemo(() => ({ language, setLanguage, t }), [language, t]);

  return React.createElement(LocalizationContext.Provider, { value: value }, children);
};

export type ColorScheme = 'teal' | 'blue' | 'emerald' | 'purple' | 'crimson';

export const ThemeContext = React.createContext({
  theme: 'light' as 'light' | 'dark',
  setTheme: (theme: 'light' | 'dark') => {},
  colorScheme: 'teal' as ColorScheme,
  setColorScheme: (scheme: ColorScheme) => {},
});

export const ThemeProvider = ({ children }: { children: React.ReactNode }): React.ReactElement => {
  const [theme, setTheme] = React.useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('pms_theme') as 'light' | 'dark') || 'light';
  });
  const [colorScheme, setColorScheme] = React.useState<ColorScheme>(() => {
    return (localStorage.getItem('pms_color_scheme') as ColorScheme) || 'teal';
  });

  React.useEffect(() => {
    localStorage.setItem('pms_theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  React.useEffect(() => {
    localStorage.setItem('pms_color_scheme', colorScheme);
    document.documentElement.setAttribute('data-color-scheme', colorScheme);
  }, [colorScheme]);

  const value = React.useMemo(() => ({ theme, setTheme, colorScheme, setColorScheme }), [theme, colorScheme]);

  return React.createElement(ThemeContext.Provider, { value }, children);
};