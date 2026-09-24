/**
 * Every user-facing string (NFR-I18N-1). Plain English, sentence case (NFR-UX-2).
 * Uppercase is applied by the display/label CSS styles, never typed here.
 */
export const en = {
  app: {
    name: 'LiftLog',
    tagline: 'No account, no tracking',
  },
  common: {
    back: 'Back',
    close: 'Close',
    cancel: 'Cancel',
    save: 'Save',
    done: 'Done',
    delete: 'Delete',
    edit: 'Edit',
    confirm: 'Confirm',
    reload: 'Reload',
    exportBackup: 'Export backup',
    settings: 'Settings',
    loading: 'Loading…',
    more: 'More',
    decrease: 'decrease',
    increase: 'increase',
  },
  tabs: {
    today: 'Today',
    plan: 'Plan',
    library: 'Library',
    progress: 'Progress',
    nav: 'Main',
  },
  errors: {
    crashTitle: 'Something broke.',
    crashBody: 'Your logged sets are saved.',
    storage: 'Saving failed. Export a backup to keep your data safe.',
    notFound: 'That page doesn’t exist.',
    goHome: 'Go to today',
  },
  update: {
    ready: 'New version',
    reload: 'Reload',
    later: 'After your workout',
    offlineReady: 'Ready to work offline',
  },
  theme: {
    system: 'System',
    paper: 'Paper',
    iron: 'Iron',
  },
  units: {
    kg: 'kg',
    lb: 'lb',
    perHand: 'kg / hand',
  },
  dev: {
    components: 'Components',
    themeLabel: 'Theme',
  },
} as const;

export type Copy = typeof en;
