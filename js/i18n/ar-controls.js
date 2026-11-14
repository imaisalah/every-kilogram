// Arabic strings for the character controller, the Controls help card, the
// camera settings and the screens' new control hints (merged into
// SMD.i18nDicts.ar).
(function () {
  const SMD = (globalThis.SMD = globalThis.SMD || {});
  SMD.i18nDicts = SMD.i18nDicts || {};
  const ar = (SMD.i18nDicts.ar = SMD.i18nDicts.ar || {});
  Object.assign(ar, {
    // The controller's overlay.
    'ctl.hint.free': 'اضغط Esc لتحرير الفأرة',
    'ctl.hint.click': 'انقر لتنظر حولك · H: التحكم',
    // The Controls help card.
    'ctl.help.title': 'التحكم',
    'ctl.help.device': 'الجهاز',
    'ctl.help.now': 'هذا ما تستخدمه الآن. تتبدل البطاقة وحدها.',
    'ctl.help.other': 'معروضة لجهاز آخر.',
    'ctl.help.note': 'تتبعك الكاميرا من الخلف وأنت تمشي. في الإعدادات: سرعة النظر، وعكس الأعلى والأسفل، والكاميرا التلقائية.',
    'ctl.dev.keyboard': 'لوحة المفاتيح والفأرة',
    'ctl.dev.gamepad': 'يد التحكم',
    'ctl.dev.touch': 'اللمس',
    'ctl.or': 'أو',
    'ctl.kb.mouse': 'الفأرة',
    'ctl.kb.wheel': 'العجلة',
    'ctl.pad.ls': 'العصا اليسرى',
    'ctl.pad.rs': 'العصا اليمنى',
    'ctl.touch.left': 'الإبهام الأيسر',
    'ctl.touch.right': 'اسحب على اليمين',
    'ctl.touch.tap': 'انقر',
    'ctl.touch.prompt': 'الزر الكبير',
    'ctl.touch.pinch': 'قرص بإصبعين',
    'ctl.do.move': 'تحرك (ادفعها بعيدًا لتجري)',
    'ctl.do.moveKeys': 'تحرك (بالنسبة إلى الكاميرا)',
    'ctl.do.moveTouch': 'المس واسحب في أي مكان على اليسار: تظهر عصا تحكم. ادفعها بعيدًا لتجري.',
    'ctl.do.look': 'أدر الكاميرا',
    'ctl.do.lookMouse': 'أدر الكاميرا: اسحب، أو اضغط الزر الأيمن، أو انقر مرة لتمسك الفأرة (Esc يحررها)',
    'ctl.do.lookKeys': 'أدر الكاميرا بالمفاتيح',
    'ctl.do.recenter': 'الكاميرا خلفك',
    'ctl.do.run': 'اجرِ',
    'ctl.do.use': 'استخدم، تحدث، افتح (واضغط الأزرار في البطاقات)',
    'ctl.do.useTouch': 'استخدم، تحدث، افتح: يظهر الزر حين يكون شيء أمامك',
    'ctl.do.back': 'رجوع، أغلق البطاقة، ضع ما تحمله',
    'ctl.do.hop': 'قفزة صغيرة',
    'ctl.do.cycle': 'الشيء التالي أو السابق لتستخدمه',
    'ctl.do.help': 'هذه البطاقة',
    'ctl.do.tap': 'امشِ إلى هناك، أو اذهب إلى ما نقرت عليه',
    'ctl.do.zoom': 'قرّب وبعّد',
    // Settings: the camera.
    'settings.camera': 'الكاميرا',
    'settings.camera.follow': 'الكاميرا تتبعك تلقائيًا',
    'settings.camera.speed': 'سرعة النظر',
    'settings.camera.slow': 'بطيئة',
    'settings.camera.normal': 'عادية',
    'settings.camera.fast': 'سريعة',
    'settings.camera.faster': 'سريعة جدًا',
    'settings.camera.invert': 'اعكس الأعلى والأسفل',
    'settings.camera.note': 'وأنت تمشي، تدور الكاميرا لتصبح خلفك. أدرها بنفسك بالفأرة أو بالعصا اليمنى في أي وقت.',
    // HQ.
    'hq.w.goIn': 'ادخل: {name}',
    'hq.w.talkTo2': 'تحدث مع {name}',
    'hq.menu.controls': 'التحكم',
    'hq.menu.settings': 'الإعدادات',
    'hq.w.hint2': 'امشِ: W A S D (Shift للجري) · انظر: الفأرة · استخدم: E · التحكم: H',
    'hq.w.hintTouch2': 'الإبهام الأيسر: امشِ · الجهة اليمنى: انظر · انقر لتذهب · قرّب بإصبعين',
    'hq.coachW.b2': 'امشِ بـ W A S D (و Shift للجري)؛ تتبعك الكاميرا من الخلف. اقترب من باب أو من شخص واضغط E: هم يعرفون ما عليك فعله. H تعرض كل أزرار التحكم.',
    'hq.coachW.bTouch2': 'اسحب بإبهامك الأيسر لتمشي (تظهر عصا تحكم)، واسحب على اليمين لتنظر. اقترب من باب أو من شخص وانقر الزر الكبير: هم يعرفون ما عليك فعله.',
    // Designer.
    'design.h.hint2': 'W A S D: امشِ (Shift للجري) · الفأرة: انظر · E: استخدم · Q: ضع القطعة · H: التحكم',
    'design.h.hint.touch2': 'الإبهام الأيسر: امشِ · الجهة اليمنى: انظر · انقر رفًا، ثم المركبة',
    // Test hall.
    'testlab.p.use': 'استخدم وحدة التحكم: {name}',
    'testlab.hint.touch2': 'الإبهام الأيسر: امشِ · الجهة اليمنى: انظر · انقر محطة لتستخدمها',
    'testlab.hint.run': 'للجري',
    'testlab.hint.mouse': 'الفأرة: انظر',
    'testlab.hint.help': 'التحكم',
    // Launch day.
    'ld.p.inspect': 'افحص',
    'ld.hint.walk2': 'امشِ بـ W A S D (و Shift للجري)، وانظر بالفأرة، و E تفحص ما أمامك. H: التحكم.',
    'ld.hint.walkTouch': 'الإبهام الأيسر: امشِ · الجهة اليمنى: انظر · انقر علامة لتفحصها',
  });
})();
