import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { watch } from 'chokidar';
import { ESLint } from 'eslint';
import { format, resolveConfig } from 'prettier';

const LANGUAGE_FILE_NAMES = ['en.json', 'ru.json'];
const PLURAL_SUFFIX_PATTERN = /_(few|many|one|other|two|zero)$/u;
const INTERPOLATION_PATTERN = /\{\{\s*([^,\s}]+)[^}]*\}\}/gu;
const SCRIPT_ROOT = import.meta.dirname;
const WEB_ROOT = resolve(SCRIPT_ROOT, '../..');
const SOURCE_ROOT = join(WEB_ROOT, 'src');
const GENERATED_FILE = join(
  SOURCE_ROOT,
  'shared',
  'i18n',
  '__generated__',
  'WarChestResources.d.ts'
);
const GENERATED_FILE_LINTER = new ESLint({ cwd: WEB_ROOT, fix: true });
const IS_WATCH_MODE = process.argv.includes('--watch');

await run();

async function run() {
  try {
    await generateLocaleResources();

    if (IS_WATCH_MODE) {
      watchLocaleResources();
    }
  } catch (error) {
    reportError(error);
    process.exitCode = 1;
  }
}

async function generateLocaleResources() {
  const resources = await readLocaleResources();
  const definition = createResourcesDefinition(resources);

  await mkdir(dirname(GENERATED_FILE), { recursive: true });
  await writeFile(GENERATED_FILE, definition, 'utf8');
  await formatGeneratedFile();
  await lintGeneratedFile();

  console.log(`✅ Generated locale types for ${resources.length} namespaces.`);
}

async function readLocaleResources() {
  const localeDirectories = await findLocaleDirectories(SOURCE_ROOT);
  const resources = await Promise.all(
    localeDirectories.map(readNamespaceResources)
  );

  return resources.sort((firstResource, secondResource) =>
    firstResource.namespace.localeCompare(secondResource.namespace)
  );
}

async function findLocaleDirectories(directoryPath) {
  const entries = await readdir(directoryPath, { withFileTypes: true });
  const localeDirectories = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === '__generated__') {
      continue;
    }

    const entryPath = join(directoryPath, entry.name);

    if (entry.name === 'i18n') {
      const fileNames = await readdir(entryPath);

      if (
        LANGUAGE_FILE_NAMES.some((fileName) => fileNames.includes(fileName))
      ) {
        localeDirectories.push(entryPath);
      }

      continue;
    }

    localeDirectories.push(...(await findLocaleDirectories(entryPath)));
  }

  return localeDirectories;
}

async function readNamespaceResources(localeDirectory) {
  const namespace = getNamespace(localeDirectory);
  const [englishResources, russianResources] = await Promise.all([
    readLanguageResources(localeDirectory, 'en'),
    readLanguageResources(localeDirectory, 'ru'),
  ]);

  const logicalKeys = validateResources({
    englishResources,
    namespace,
    russianResources,
  });

  return { logicalKeys, namespace, resources: russianResources };
}

function getNamespace(localeDirectory) {
  const sliceDirectory = dirname(localeDirectory);
  const namespace = relative(SOURCE_ROOT, sliceDirectory).split(sep).join('/');

  if (namespace === '' || namespace.startsWith('../')) {
    throw new Error(`Invalid locale namespace for ${localeDirectory}.`);
  }

  return namespace;
}

async function readLanguageResources(localeDirectory, language) {
  const filePath = join(localeDirectory, `${language}.json`);
  let source;

  try {
    source = await readFile(filePath, 'utf8');
  } catch (error) {
    throw new Error(`Locale pair is incomplete: ${filePath}.`, {
      cause: error,
    });
  }

  let resources;

  try {
    resources = JSON.parse(source);
  } catch (error) {
    throw new Error(`Locale file contains invalid JSON: ${filePath}.`, {
      cause: error,
    });
  }

  validateResourceObject(resources, filePath);

  return resources;
}

function validateResourceObject(resources, filePath) {
  if (!isPlainObject(resources)) {
    throw new Error(`Locale root must be an object: ${filePath}.`);
  }

  validateResourceValue(resources, filePath, []);
}

function validateResourceValue(value, filePath, keyPath) {
  if (typeof value === 'string') {
    return;
  }

  if (!isPlainObject(value) || Object.keys(value).length === 0) {
    throw new Error(
      `Locale value must be a string or a non-empty object: ${filePath}#${keyPath.join('.')}.`
    );
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    validateResourceValue(nestedValue, filePath, [...keyPath, key]);
  }
}

function isPlainObject(value) {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function validateResources(input) {
  const englishKeys = collectLogicalKeys(input.englishResources);
  const russianKeys = collectLogicalKeys(input.russianResources);

  compareLogicalKeys({
    firstKeys: englishKeys,
    firstLanguage: 'en',
    namespace: input.namespace,
    secondKeys: russianKeys,
    secondLanguage: 'ru',
  });

  return mergeLogicalKeys(englishKeys, russianKeys);
}

function collectLogicalKeys(resources) {
  const keys = new Map();

  collectResourceKeys(resources, [], keys);

  return keys;
}

function collectResourceKeys(resources, parentPath, keys) {
  for (const [key, value] of Object.entries(resources)) {
    const keyPath = [...parentPath, key];

    if (typeof value === 'string') {
      addLogicalKey(keys, keyPath, value);
      continue;
    }

    collectResourceKeys(value, keyPath, keys);
  }
}

function addLogicalKey(keys, keyPath, value) {
  const lastKey = keyPath.at(-1);
  const isPlural = PLURAL_SUFFIX_PATTERN.test(lastKey);
  const logicalLastKey = lastKey.replace(PLURAL_SUFFIX_PATTERN, '');
  const logicalPath = [...keyPath.slice(0, -1), logicalLastKey].join('.');
  const interpolationNames = getInterpolationNames(value);
  const existingKey = keys.get(logicalPath);

  if (existingKey === undefined) {
    keys.set(logicalPath, { interpolationNames, isPlural });
    return;
  }

  if (!setsAreEqual(existingKey.interpolationNames, interpolationNames)) {
    throw new Error(
      `Plural forms use different interpolation variables: ${logicalPath}.`
    );
  }

  existingKey.isPlural ||= isPlural;
}

function getInterpolationNames(value) {
  return new Set(
    [...value.matchAll(INTERPOLATION_PATTERN)].map((match) => match[1])
  );
}

function compareLogicalKeys(input) {
  const firstKeyNames = new Set(input.firstKeys.keys());
  const secondKeyNames = new Set(input.secondKeys.keys());
  const missingInSecond = [...firstKeyNames].filter(
    (key) => !secondKeyNames.has(key)
  );
  const missingInFirst = [...secondKeyNames].filter(
    (key) => !firstKeyNames.has(key)
  );

  if (missingInSecond.length > 0 || missingInFirst.length > 0) {
    throw new Error(
      `Locale keys differ in ${input.namespace}. Missing in ${input.secondLanguage}: ${missingInSecond.join(', ') || 'none'}. Missing in ${input.firstLanguage}: ${missingInFirst.join(', ') || 'none'}.`
    );
  }

  for (const key of firstKeyNames) {
    if (
      !setsAreEqual(
        input.firstKeys.get(key).interpolationNames,
        input.secondKeys.get(key).interpolationNames
      )
    ) {
      throw new Error(
        `Interpolation variables differ in ${input.namespace}.${key}.`
      );
    }
  }
}

function mergeLogicalKeys(firstKeys, secondKeys) {
  return new Map(
    [...firstKeys].map(([key, firstKey]) => [
      key,
      {
        interpolationNames: firstKey.interpolationNames,
        isPlural: firstKey.isPlural || secondKeys.get(key).isPlural,
      },
    ])
  );
}

function setsAreEqual(firstSet, secondSet) {
  return (
    firstSet.size === secondSet.size &&
    [...firstSet].every((value) => secondSet.has(value))
  );
}

function createResourcesDefinition(resources) {
  const resourceLines = resources.flatMap((resource) => [
    `  ${JSON.stringify(resource.namespace)}: ${createTypeLiteral(resource.resources, 2)};`,
  ]);
  const translationParameterLines = resources.flatMap((resource) =>
    [...resource.logicalKeys]
      .sort(([firstKey], [secondKey]) => firstKey.localeCompare(secondKey))
      .map(
        ([key, logicalKey]) =>
          `  ${JSON.stringify(`${resource.namespace}.${key}`)}: ${createTranslationParametersType(logicalKey)};`
      )
  );

  return [
    '// This file is generated by tools/locale/generateLocaleResources.mjs.',
    '// Do not edit it manually.',
    '',
    'export interface WarChestResources {',
    ...resourceLines,
    '}',
    '',
    'export interface WarChestTranslationParameters {',
    ...translationParameterLines,
    '}',
    '',
    'export type WarChestNamespace = keyof WarChestResources;',
    '',
  ].join('\n');
}

function createTranslationParametersType(logicalKey) {
  const interpolationNames = [...logicalKey.interpolationNames].sort();
  const properties = interpolationNames.map(
    (interpolationName) => `${JSON.stringify(interpolationName)}: unknown;`
  );

  if (logicalKey.isPlural) {
    properties.push('count: number;');
  }

  return properties.length === 0 ? 'null' : `{ ${properties.join(' ')} }`;
}

function createTypeLiteral(value, indentationLevel) {
  if (typeof value === 'string') {
    return JSON.stringify(createInterpolationSignature(value));
  }

  const indentation = '  '.repeat(indentationLevel);
  const childIndentation = '  '.repeat(indentationLevel + 1);
  const properties = Object.entries(value)
    .sort(([firstKey], [secondKey]) => firstKey.localeCompare(secondKey))
    .map(
      ([key, nestedValue]) =>
        `${childIndentation}${JSON.stringify(key)}: ${createTypeLiteral(nestedValue, indentationLevel + 1)};`
    );

  return ['{', ...properties, `${indentation}}`].join('\n');
}

function createInterpolationSignature(value) {
  return [...getInterpolationNames(value)]
    .sort()
    .map((interpolationName) => `{{${interpolationName}}}`)
    .join(' ');
}

function watchLocaleResources() {
  let generationTimeout;
  let generationPromise = Promise.resolve();
  const watcher = watch(SOURCE_ROOT, {
    awaitWriteFinish: true,
    ignoreInitial: true,
  });

  watcher.on('all', (eventName, filePath) => {
    if (!isLocaleFile(filePath)) {
      return;
    }

    clearTimeout(generationTimeout);
    generationTimeout = setTimeout(() => {
      generationPromise = generationPromise
        .then(generateLocaleResources)
        .catch(reportError);
    }, 100);
  });

  console.log('👀 Watching locale resources.');
}

function isLocaleFile(filePath) {
  const normalizedPath = filePath.split(sep).join('/');

  return /\/i18n\/(en|ru)\.json$/u.test(normalizedPath);
}

function reportError(error) {
  const message = error instanceof Error ? error.message : String(error);

  console.error(`❌ ${message}`);
}

async function formatGeneratedFile() {
  const [source, prettierConfig] = await Promise.all([
    readFile(GENERATED_FILE, 'utf8'),
    resolveConfig(GENERATED_FILE),
  ]);
  const formattedSource = await format(source, {
    ...(prettierConfig ?? {}),
    filepath: GENERATED_FILE,
  });

  await writeFile(GENERATED_FILE, formattedSource, 'utf8');
}

async function lintGeneratedFile() {
  const results = await GENERATED_FILE_LINTER.lintFiles([GENERATED_FILE]);

  await ESLint.outputFixes(results);

  const formatter = await GENERATED_FILE_LINTER.loadFormatter('stylish');
  const report = await formatter.format(results);

  if (report !== '') {
    console.log(report);
  }

  const errorCount = results.reduce(
    (total, result) => total + result.errorCount,
    0
  );

  if (errorCount > 0) {
    throw new Error(`ESLint found ${errorCount} errors in ${GENERATED_FILE}.`);
  }
}
