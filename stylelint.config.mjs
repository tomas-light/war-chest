export default {
  extends: [
    'stylelint-config-standard',
    'stylelint-config-standard-scss',
    'stylelint-config-css-modules',
    '@tomas-light/stylelint-config-idiomatic-order',
  ],
  ignoreFiles: [
    '**/coverage/**',
    '**/node_modules/**',
    '**/ts-builds/**',
    'packages/database/migrations/**',
  ],
  rules: {
    'custom-property-pattern': null,
    'declaration-block-no-redundant-longhand-properties': null,
    'keyframes-name-pattern': null,
    'no-descending-specificity': null,
    'property-no-unknown': null,
    'scss/at-mixin-pattern': null,
    'scss/dollar-variable-pattern': null,
    'scss/operator-no-newline-after': null,
    'selector-class-pattern': null,
    'selector-id-pattern': null,
    'selector-pseudo-class-no-unknown': [
      true,
      {
        ignorePseudoClasses: ['global'],
      },
    ],
    'selector-pseudo-element-colon-notation': 'single',
    'value-keyword-case': [
      'lower',
      {
        camelCaseSvgKeywords: true,
      },
    ],
  },
};
