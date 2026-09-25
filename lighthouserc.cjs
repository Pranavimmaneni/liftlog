/**
 * Lighthouse CI (M5): every category ≥ 0.9 on mobile. By default it audits the production build served
 * like Vercel serves it (Brotli; scripts/serve-dist.ts). The Vercel-preview job in
 * .github/workflows/lighthouse.yml passes LHCI_URLS (and a protection-bypass header) instead.
 */
const base = process.env.LHCI_BASE_URL || 'http://localhost:4175';
const urls = (process.env.LHCI_URLS || '/,/install').split(',').map((p) => base.replace(/\/$/, '') + p);
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

module.exports = {
  ci: {
    collect: {
      url: urls,
      numberOfRuns: 3,
      ...(process.env.LHCI_BASE_URL
        ? {}
        : { startServerCommand: 'npx tsx scripts/serve-dist.ts 4175', startServerReadyPattern: 'dist on' }),
      settings: {
        onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
        ...(bypass ? { extraHeaders: JSON.stringify({ 'x-vercel-protection-bypass': bypass }) } : {}),
      },
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.9, aggregationMethod: 'median-run' }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['error', { minScore: 0.9 }],
        'categories:seo': ['error', { minScore: 0.9 }],
      },
    },
    upload: { target: 'filesystem', outputDir: '.lighthouseci' },
  },
};
