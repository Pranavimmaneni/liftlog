// Sets the theme and the look before first paint (FR-SET-1, FR-DSN-1). Mirrors the Dexie settings
// via localStorage.
(function () {
  var root = document.documentElement;
  try {
    var pref = localStorage.getItem('ll-theme') || 'system';
    var dark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    var t = pref === 'system' ? (dark ? 'iron' : 'paper') : pref;
    root.setAttribute('data-theme', t);
    root.setAttribute('data-design', localStorage.getItem('ll-design') === 'sun' ? 'sun' : 'classic');
    root.setAttribute('data-glass', localStorage.getItem('ll-glass') === 'off' ? 'off' : 'on');
  } catch (e) {
    root.setAttribute('data-theme', 'paper');
    root.setAttribute('data-design', 'classic');
  }
  // The APK uses hash routes (#/food); the PWA uses clean URLs.
  var path = location.hash.length > 1 ? location.hash.slice(1) : location.pathname;
  root.setAttribute('data-section', path === '/food' || path.indexOf('/food/') === 0 ? 'food' : 'workout');
})();
