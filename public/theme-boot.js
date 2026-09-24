// Sets the theme before first paint (FR-SET-1). Mirrors the Dexie setting via localStorage.
(function () {
  try {
    var pref = localStorage.getItem('ll-theme') || 'system';
    var dark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    var t = pref === 'system' ? (dark ? 'iron' : 'paper') : pref;
    document.documentElement.setAttribute('data-theme', t);
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'paper');
  }
})();
