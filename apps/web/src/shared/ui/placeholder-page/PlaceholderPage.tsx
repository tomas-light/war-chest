import type { ReactNode } from 'react';
import classes from './PlaceholderPage.module.scss';

interface PlaceholderPageProps {
  children?: ReactNode;
  description: string;
  title: string;
}

export function PlaceholderPage({
  children,
  description,
  title,
}: PlaceholderPageProps) {
  return (
    <main className={classes.page}>
      <section className={classes.content}>
        <p className={classes.eyebrow}>War Chest</p>
        <h1 className={classes.title}>{title}</h1>
        <p className={classes.description}>{description}</p>
        {children}
      </section>
    </main>
  );
}
