import { type AvatarPresetId, AVATAR_PRESETS } from '@war-chest/api-contracts';
import clsx from 'clsx';
import { type ChangeEvent, type PropsWithChildren, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useAuthSession } from '#/entities/auth-session';
import { usePublicUserQuery, UserAvatar } from '#/entities/user';
import { useApiErrorMessage } from '#/shared/api';
import { appRoutes } from '#/shared/config';
import { useTranslation } from '#/shared/i18n/useTranslation';
import { Button } from '#/shared/ui/button';
import { LoadingIndicator } from '#/shared/ui/loading-indicator';
import classes from './UserProfilePage.module.scss';

export function UserProfilePage() {
  const { t } = useTranslation('pages/user-profile', {
    keyPrefix: 'UserProfilePage',
  });
  const { userId } = useParams();
  const publicUserQuery = usePublicUserQuery(userId ?? '');
  const {
    removeAvatar: removeCurrentUserAvatar,
    selectAvatarPreset,
    session,
    updateDisplayName,
    uploadAvatar: uploadCurrentUserAvatar,
  } = useAuthSession();
  const getApiErrorMessage = useApiErrorMessage();
  const [displayName, setDisplayName] = useState(
    session?.user.displayName ?? ''
  );
  const [isPending, setIsPending] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (userId !== undefined) {
    if (publicUserQuery.isPending) {
      return (
        <ProfileState>
          <LoadingIndicator label={t('loadingProfile')} />
        </ProfileState>
      );
    }

    if (publicUserQuery.isError) {
      return (
        <ProfileState>
          <h1>{t('errorTitle')}</h1>
          <p className={classes.error} role="alert">
            {getApiErrorMessage(publicUserQuery.error)}
          </p>
          <Button onClick={() => void publicUserQuery.refetch()}>
            {t('retry')}
          </Button>
        </ProfileState>
      );
    }

    const publicUser = publicUserQuery.data;

    return (
      <main className={classes.page}>
        <header className={classes.header}>
          <UserAvatar size="large" user={publicUser} />
          <div>
            <p className={classes.eyebrow}>{t('publicProfile')}</p>
            <h1>{publicUser.displayName}</h1>
            <p>{t('publicUserDescription')}</p>
          </div>
        </header>

        <HistorySection userId={publicUser.id} />
      </main>
    );
  }

  if (session === null) {
    return null;
  }

  const currentUser = session.user;

  return (
    <main className={classes.page}>
      <header className={classes.header}>
        <UserAvatar size="large" user={currentUser} />
        <div>
          <h1>{t('title')}</h1>
          <p>{t('currentUserDescription')}</p>
        </div>
      </header>

      <HistorySection userId={currentUser.id} />

      <form
        className={classes.section}
        onSubmit={(event) => {
          event.preventDefault();

          void mutateProfile(
            () => updateDisplayName(displayName),
            t('nicknameSaved')
          );
        }}
      >
        <h2>{t('nicknameTitle')}</h2>
        <label className={classes.label} htmlFor="profile-display-name">
          {t('nicknameLabel')}
        </label>
        <div className={classes.inlineForm}>
          <input
            className={classes.input}
            disabled={isPending}
            id="profile-display-name"
            maxLength={24}
            minLength={2}
            onChange={(event) => setDisplayName(event.target.value)}
            required
            value={displayName}
          />
          <Button disabled={isPending} type="submit">
            {t('saveNickname')}
          </Button>
        </div>
        <p className={classes.help}>{t('nicknameRequirements')}</p>
      </form>

      <section className={classes.section}>
        <h2>{t('avatarTitle')}</h2>
        <p className={classes.help}>{t('avatarDescription')}</p>
        <div className={classes.presets}>
          {AVATAR_PRESETS.map((preset) => (
            <button
              className={classes.preset}
              disabled={isPending}
              key={preset.id}
              onClick={() => void selectPreset(preset.id)}
              type="button"
            >
              <img alt={t(`presets.${preset.id}`)} src={preset.imageUrl} />
              <span>{t(`presets.${preset.id}`)}</span>
            </button>
          ))}
        </div>
        <div className={classes.avatarActions}>
          <label className={classes.fileButton}>
            <span>{t('uploadAvatar')}</span>
            <input
              accept="image/jpeg,image/png,image/webp"
              disabled={isPending}
              onChange={uploadAvatar}
              type="file"
            />
          </label>
          <Button
            disabled={isPending}
            onClick={() => void removeAvatar()}
            variant="secondary"
          >
            {t('removeAvatar')}
          </Button>
        </div>
      </section>

      <div className={classes.feedback}>
        {errorMessage === null ? null : (
          <p className={classes.error} role="alert">
            {errorMessage}
          </p>
        )}
        {successMessage === null ? null : (
          <p className={classes.success} role="status">
            {successMessage}
          </p>
        )}
      </div>
    </main>
  );

  function selectPreset(presetId: AvatarPresetId): Promise<void> {
    if (currentUser.avatarVersion === `preset:${presetId}`) {
      return Promise.resolve();
    }

    return mutateProfile(() => selectAvatarPreset(presetId), t('avatarSaved'));
  }

  function uploadAvatar(event: ChangeEvent<HTMLInputElement>): void {
    const [file] = event.target.files ?? [];

    if (file === undefined) {
      return;
    }

    void mutateProfile(() => uploadCurrentUserAvatar(file), t('avatarSaved'));
    event.target.value = '';
  }

  function removeAvatar(): Promise<void> {
    return mutateProfile(removeCurrentUserAvatar, t('avatarRemoved'));
  }

  async function mutateProfile(
    mutation: () => Promise<unknown>,
    success: string
  ): Promise<void> {
    if (isPending) {
      return;
    }

    setIsPending(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await mutation();
      setSuccessMessage(success);
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error));
    } finally {
      setIsPending(false);
    }
  }
}

interface HistorySectionProps {
  userId: string;
}

function HistorySection(props: HistorySectionProps) {
  const { userId } = props;
  const { t } = useTranslation('pages/user-profile', {
    keyPrefix: 'HistorySection',
  });

  return (
    <section className={clsx(classes.section, classes.historySection)}>
      <div>
        <h2>{t('title')}</h2>
        <p className={classes.help}>{t('description')}</p>
      </div>
      <Link
        className={classes.historyLink}
        to={appRoutes.users.userId(userId).history.url()}
      >
        {t('openHistory')}
      </Link>
    </section>
  );
}

function ProfileState(props: PropsWithChildren) {
  return (
    <main className={classes.page}>
      <section className={clsx(classes.section, classes.state)}>
        {props.children}
      </section>
    </main>
  );
}
