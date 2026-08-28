import type { WarChestResources } from '#/shared/i18n/__generated__/WarChestResources';

declare module 'i18next' {
  interface CustomTypeOptions {
    enableSelector: false;
    resources: WarChestResources;
    returnNull: false;
    strictKeyChecks: true;
  }
}
