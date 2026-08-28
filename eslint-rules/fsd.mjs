const fsdLayerOrder = new Map(
  ['shared', 'entities', 'features', 'widgets', 'pages', 'app'].map(
    (layer, index) => [layer, index]
  )
);

const fsdTranslationsPlugin = {
  meta: {
    name: 'fsd-translations-linter',
    version: '1.0.0',
  },
  rules: {
    'no-fsd-translations': createNoFsdTranslationsRule(),
  },
};

export function createFsdImportLinterConfigs(sourcePath) {
  return [
    createFsdLayerImportConfig({
      layer: 'shared',
      prohibitedGroups: ['entities', 'features', 'widgets', 'pages', 'app'],
      sourcePath,
    }),
    createFsdLayerImportConfig({
      layer: 'entities',
      prohibitedGroups: ['features', 'widgets', 'pages', 'app'],
      sourcePath,
    }),
    createFsdLayerImportConfig({
      layer: 'features',
      prohibitedGroups: ['widgets', 'pages', 'app'],
      sourcePath,
    }),
    createFsdLayerImportConfig({
      layer: 'widgets',
      prohibitedGroups: ['pages', 'app'],
      sourcePath,
    }),
    createFsdLayerImportConfig({
      layer: 'pages',
      prohibitedGroups: ['app'],
      sourcePath,
    }),
    createFsdLayerImportConfig({
      layer: 'app',
      sourcePath,
    }),
  ];
}

export function getFsdTranslationsLinterConfig(sourcePath) {
  return {
    files: [`${sourcePath}/**/*.{ts,tsx}`],
    plugins: {
      'fsd-translations': fsdTranslationsPlugin,
    },
    rules: {
      'fsd-translations/no-fsd-translations': 'error',
    },
  };
}

function createFsdLayerImportConfig({
  sourcePath,
  layer,
  prohibitedGroups = [],
}) {
  const prohibitedGroupsPattern = {
    message: `Importing '${prohibitedGroups.join(
      "', '"
    )}' from '${layer}' layer is not allowed.`,
    regex: `#/(${prohibitedGroups.join('|')})`,
  };

  const sameLayerPattern = createSameLayerImportPattern(layer);
  const restrictedPatterns =
    prohibitedGroups.length === 0
      ? [sameLayerPattern]
      : [prohibitedGroupsPattern, sameLayerPattern];

  return {
    files: [`${sourcePath}/${layer}/**/*.{ts,tsx}`],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: restrictedPatterns,
        },
      ],
    },
  };
}

function createSameLayerImportPattern(layer) {
  if (layer === 'shared' || layer === 'app') {
    return {
      message: `Absolute imports within the '${layer}' layer are not allowed. Use a relative import instead.`,
      regex: `#/${layer}/.*`,
    };
  }

  return {
    message: `If you need to import within the same layer, export the required functionality from '${layer}/slice-name/crossExports.ts'.`,
    regex: `#/${layer}/(?!.*crossExports).*`,
  };
}

function createNoFsdTranslationsRule() {
  return {
    create(context) {
      const currentLocation = getCurrentFsdLocation(context.filename);

      if (!currentLocation) {
        return {};
      }

      return {
        CallExpression(node) {
          if (
            node.callee.type !== 'Identifier' ||
            node.callee.name !== 'useTranslation'
          ) {
            return;
          }

          const staticNamespace = getStaticStringFromExpression(
            node.arguments[0]
          );

          if (!staticNamespace) {
            context.report({
              message:
                'FSD translations: useTranslation requires a static namespace in layer/slice format.',
              node,
            });
            return;
          }

          validateFsdTranslationKey({
            context,
            currentLocation,
            node: node.arguments[0],
            staticKey: staticNamespace,
          });
        },
        JSXAttribute(node) {
          if (
            node.name?.type !== 'JSXIdentifier' ||
            node.name.name !== 'i18nKey'
          ) {
            return;
          }

          const staticValue = getStaticStringFromJsxAttributeValue(node.value);

          if (!staticValue) {
            return;
          }

          validateFsdTranslationKey({
            context,
            currentLocation,
            node: node.value,
            staticKey: staticValue,
          });
        },
      };
    },
    meta: {
      docs: {
        description:
          'Disallow translations from higher FSD layers and sibling slices.',
      },
      schema: [],
      type: 'problem',
    },
  };
}

function validateFsdTranslationKey({
  context,
  currentLocation,
  staticKey,
  node,
}) {
  const parsedLocation = parseFsdLayerAndSlice(staticKey);

  if (!parsedLocation) {
    return;
  }

  const currentLayerIndex = fsdLayerOrder.get(currentLocation.layer);
  const referencedLayerIndex = fsdLayerOrder.get(parsedLocation.layer);

  if (referencedLayerIndex > currentLayerIndex) {
    context.report({
      message: `FSD translations: referencing '${parsedLocation.layer}/${parsedLocation.sliceName}' from '${currentLocation.layer}/${currentLocation.sliceName}' is not allowed. Use a namespace from the same or a lower layer.`,
      node,
    });
    return;
  }

  if (
    parsedLocation.layer === currentLocation.layer &&
    parsedLocation.sliceName !== currentLocation.sliceName
  ) {
    context.report({
      message: `FSD translations: referencing slice '${parsedLocation.sliceName}' inside '${parsedLocation.layer}' is not allowed from '${currentLocation.layer}/${currentLocation.sliceName}'. Use '${currentLocation.layer}/${currentLocation.sliceName}' instead.`,
      node,
    });
  }
}

function getCurrentFsdLocation(filename) {
  const normalizedFilename = String(filename).replaceAll('\\', '/');
  const matches = [
    ...normalizedFilename.matchAll(
      /\/(shared|entities|features|widgets|pages|app)\/([^/]+)\//g
    ),
  ];

  if (matches.length === 0) {
    return null;
  }

  const [, layer, sliceName] = matches.at(-1);

  return { layer, sliceName };
}

function getStaticStringFromExpression(expression) {
  if (!expression) {
    return null;
  }

  if (expression.type === 'Literal' && typeof expression.value === 'string') {
    return expression.value;
  }

  if (
    expression.type === 'TemplateLiteral' &&
    expression.expressions.length === 0 &&
    expression.quasis.length === 1
  ) {
    return expression.quasis[0].value?.cooked ?? null;
  }

  return null;
}

function getStaticStringFromJsxAttributeValue(value) {
  if (!value) {
    return null;
  }

  if (value.type === 'Literal' && typeof value.value === 'string') {
    return value.value;
  }

  if (value.type === 'JSXExpressionContainer') {
    return getStaticStringFromExpression(value.expression);
  }

  return null;
}

function parseFsdLayerAndSlice(translationKey) {
  const [layer, namespace] = String(translationKey).split('/');

  if (!layer || !namespace || !fsdLayerOrder.has(layer)) {
    return null;
  }

  const [sliceName] = namespace.split('.');

  return { layer, sliceName };
}
