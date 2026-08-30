import {
  type CSSProperties,
  type PropsWithChildren,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { WarChestLogo } from '../war-chest-logo';
import classes from './PlaceholderPage.module.scss';

interface PlaceholderPageProps {
  children?: ReactNode;
  description: string;
  logoHref?: string;
  title: string;
}

export function PlaceholderPage(props: PlaceholderPageProps) {
  const { children, description, logoHref, title } = props;
  const { t } = useTranslation('shared/ui', {
    keyPrefix: 'PlaceholderPage',
  });

  return (
    <main className={classes.page}>
      <section className={classes.content}>
        <div className={classes.brand}>
          {logoHref === undefined ? (
            <div className={classes.logoFrame}>
              <WarChestLogo className={classes.logo} />
            </div>
          ) : (
            <a
              aria-label={t('homeLinkLabel')}
              className={classes.logoFrame}
              href={logoHref}
            >
              <WarChestLogo className={classes.logo} />
            </a>
          )}
          <p className={classes.eyebrow}>War Chest</p>
        </div>
        <div className={classes.body}>
          <h1 className={classes.title}>{title}</h1>
          <p className={classes.description}>{description}</p>
          <AnimatedContent>{children}</AnimatedContent>
        </div>
      </section>
    </main>
  );
}

function AnimatedContent(props: PropsWithChildren) {
  const { children } = props;
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState<number>();
  const animatedStyle: CSSProperties | undefined =
    contentHeight === undefined ? undefined : { height: contentHeight };

  useEffect(() => {
    const contentElement = contentRef.current;

    if (contentElement === null) {
      return;
    }

    const resizeObserver = new ResizeObserver(([entry]) => {
      if (entry !== undefined) {
        setContentHeight(Math.ceil(entry.contentRect.height));
      }
    });

    resizeObserver.observe(contentElement);

    return () => resizeObserver.disconnect();
  }, []);

  return (
    <div className={classes.animatedContent} style={animatedStyle}>
      <div ref={contentRef} className={classes.animatedContentInner}>
        {children}
      </div>
    </div>
  );
}
