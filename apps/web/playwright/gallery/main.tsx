import { type ComponentType, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { initializeI18n } from '../../src/app/i18n/initializeI18n';
import '../../src/app/styles/index.scss';

type StoryModule = Record<string, ComponentType>;

const storyModules = import.meta.glob<StoryModule>('../../src/**/*.story.tsx', {
  eager: true,
});
const rootElement = document.querySelector('#root');

if (rootElement === null) {
  throw new Error('Component gallery root element was not found.');
}

const story = findStory(
  new URLSearchParams(window.location.search).get('story')
);

await initializeI18n();

createRoot(rootElement).render(
  <StrictMode>
    <Suspense fallback={null}>
      <story.Component />
    </Suspense>
  </StrictMode>
);

function findStory(storyId: string | null) {
  if (storyId === null) {
    throw new Error('The story query parameter is required.');
  }

  const separatorIndex = storyId.lastIndexOf('/');
  const moduleId = storyId.slice(0, separatorIndex);
  const exportName = storyId.slice(separatorIndex + 1);
  const modulePath = `../../src/${moduleId}.story.tsx`;
  const Component = storyModules[modulePath]?.[exportName];

  if (Component === undefined) {
    throw new Error(`Component story was not found: ${storyId}`);
  }

  return { Component };
}
