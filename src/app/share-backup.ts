import { exportBackupBlob } from '@/db/backup';
import { platform } from '@/platform';
import type { ShareResult } from '@/platform';

/** FR-DATA-1 + FR-PLT-6: build the backup file and hand it to the share sheet (or download it). */
export async function shareBackup(): Promise<ShareResult> {
  const { name, blob } = await exportBackupBlob();
  return platform.share({ name, mime: 'application/json', data: blob, title: 'LiftLog backup' });
}
