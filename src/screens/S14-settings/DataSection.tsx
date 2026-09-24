import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { Sheet } from '@/components/Sheet';
import { toast } from '@/components/Toast';
import { en } from '@/copy/en';
import { relativeDays, shortDate } from '@/copy/format';
import { db, TABLES } from '@/db/schema';
import { parseBackup, restoreBackup, type BackupFile, type BackupPreview } from '@/db/backup';
import { shareBackup } from '@/app/share-backup';
import { exportCsv } from '@/db/csv';
import { platform } from '@/platform';

/** S14 "Your data": back up (FR-DATA-1), restore (FR-DATA-3), CSV (FR-DATA-5), delete all (FR-DATA-4). */
export function DataSection() {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const lastBackup = useLiveQuery(
    async () => (await db.meta.get('lastBackupAt'))?.value as number | undefined,
    [],
  );
  const [restore, setRestore] = useState<{ backup: BackupFile; preview: BackupPreview } | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [del, setDel] = useState(false);
  const [typed, setTyped] = useState('');
  const s = en.settings;

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    const text = await f.text();
    const r = parseBackup(text, f.size);
    if (!r.ok) {
      setRestoreError(s.restoreError[r.error] ?? s.restoreError.bad!);
      return;
    }
    setRestoreError(null);
    setRestore({ backup: r.backup, preview: r.preview });
  };

  const doRestore = async (mode: 'replace' | 'merge') => {
    if (!restore) return;
    await restoreBackup(restore.backup, mode);
    setRestore(null);
    toast(s.restoreDone);
    navigate('/', { replace: true });
  };

  const range = (p: BackupPreview) =>
    p.firstSessionAt && p.lastSessionAt
      ? `${shortDate(p.firstSessionAt)} – ${shortDate(p.lastSessionAt)}`
      : '';

  return (
    <>
      <div className="ll-card mx-5">
        <button
          type="button"
          className="ll-row w-full text-left"
          onClick={async () => {
            const r = await shareBackup();
            if (r !== 'cancelled') toast(s.backupSaved);
          }}
        >
          <span className="min-w-0 grow">
            <span className="block text-[15px] font-semibold">{s.backup}</span>
            <span className="mt-px block text-[12px] text-ink2">
              {lastBackup ? s.lastBackup(relativeDays(lastBackup)) : s.neverBackedUp}
            </span>
          </span>
          <Icon name="download" />
        </button>
        <button type="button" className="ll-row w-full text-left" onClick={() => fileRef.current?.click()}>
          <span className="grow text-[15px] font-semibold">{s.restore}</span>
          <Icon name="upload" />
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          data-testid="restore-input"
          onChange={(e) => {
            void onFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        <button
          type="button"
          className="ll-row w-full text-left"
          onClick={async () => {
            const { name, blob } = await exportCsv();
            await platform.share({ name, mime: 'text/csv', data: blob });
          }}
        >
          <span className="grow text-[15px] font-semibold">{s.csv}</span>
          <Icon name="share" />
        </button>
        <button type="button" className="ll-row w-full text-left text-accent" onClick={() => setDel(true)}>
          <span className="grow text-[15px] font-semibold">{s.deleteAll}</span>
          <Icon name="trash" />
        </button>
      </div>
      {restoreError && (
        <p role="alert" className="mx-5 mt-2 text-[14px] text-accent">
          {restoreError}
        </p>
      )}
      <p className="mx-5 mt-2 text-[13px] text-ink2">{s.privacy}</p>

      <Sheet open={!!restore} onClose={() => setRestore(null)} title={s.restoreTitle}>
        {restore && (
          <>
            <p className="text-[15px]" data-testid="restore-preview">
              {s.restorePreview(restore.preview.sessions, restore.preview.sets, range(restore.preview))}
            </p>
            <div className="mt-4 flex flex-col gap-3">
              <Button onClick={() => doRestore('replace')}>{s.restoreReplace}</Button>
              <p className="-mt-1 text-[13px] text-ink2">{s.restoreReplaceNote}</p>
              <Button variant="secondary" onClick={() => doRestore('merge')}>
                {s.restoreMerge}
              </Button>
              <p className="-mt-1 text-[13px] text-ink2">{s.restoreMergeNote}</p>
            </div>
          </>
        )}
      </Sheet>

      <Sheet
        open={del}
        tone="danger"
        onClose={() => {
          setDel(false);
          setTyped('');
        }}
        title={s.deleteTitle}
        footer={
          <Button
            variant="destructive"
            disabled={typed !== s.deleteWord}
            onClick={async () => {
              // FR-DATA-4: typed confirmation, then clear the DB and return to onboarding.
              await db.transaction(
                'rw',
                TABLES.map((t) => db.table(t)),
                async () => {
                  for (const t of TABLES) await db.table(t).clear();
                },
              );
              try {
                localStorage.removeItem('ll-rest');
              } catch {
                /* ignore */
              }
              setDel(false);
              navigate('/onboarding/about', { replace: true });
            }}
          >
            {s.deleteButton}
          </Button>
        }
      >
        <p className="text-[15px]">{s.deleteBody}</p>
        <label className="mt-4 block">
          <span className="t-label">{s.deleteType}</span>
          <input
            className="ll-input mt-1.5"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoCapitalize="characters"
            autoComplete="off"
          />
        </label>
      </Sheet>
    </>
  );
}
