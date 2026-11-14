// Strings: SMD.t(key, englishText, params). English is the default text in the
// code; other languages live in js/i18n/<lang>.js as { key: 'text' }.
(function () {
  const SMD = (globalThis.SMD = globalThis.SMD || {});
  const dicts = (SMD.i18nDicts = SMD.i18nDicts || {});
  let lang = 'en';
  try {
    lang = localStorage.getItem('ek-lang') || (navigator.language || 'en').slice(0, 2);
  } catch (e) {}
  if (lang !== 'ar') lang = 'en';

  function fill(text, params) {
    if (!params) return text;
    return text.replace(/\{(\w+)\}/g, (m, k) => (params[k] !== undefined ? params[k] : m));
  }

  SMD.t = function t(key, english, params) {
    const d = dicts[lang];
    const text = (d && d[key]) || english || key;
    return fill(text, params);
  };
  SMD.lang = () => lang;
  SMD.dir = () => (lang === 'ar' ? 'rtl' : 'ltr');
  SMD.setLang = function setLang(l) {
    lang = l === 'ar' ? 'ar' : 'en';
    try {
      localStorage.setItem('ek-lang', lang);
    } catch (e) {}
    document.documentElement.lang = lang;
    document.documentElement.dir = SMD.dir();
    if (SMD.bus) SMD.bus.emit('lang', lang);
  };
  // Numbers stay Western digits in both languages for readability of data.
  SMD.applyLang = () => {
    document.documentElement.lang = lang;
    document.documentElement.dir = SMD.dir();
  };
})();
