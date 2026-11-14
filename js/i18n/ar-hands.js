// Arabic strings for the hands work (merged into SMD.i18nDicts.ar).
// Building the spacecraft by hand in the clean room (js/screen-design.js,
// keys design.h.*). Same rules as js/i18n/ar.js: Western digits, acronyms in
// Latin letters, {placeholders} kept exactly.
(function () {
  const SMD = (globalThis.SMD = globalThis.SMD || {});
  SMD.i18nDicts = SMD.i18nDicts || {};
  const ar = (SMD.i18nDicts.ar = SMD.i18nDicts.ar || {});
  Object.assign(ar, {
    // The switch
    'design.h.mode': 'طريقة البناء',
    'design.h.mode.hands': 'ابنِ بيديك',
    'design.h.mode.panel': 'استخدم اللوحة',
    'design.h.hint': 'WASD أو الأسهم: امشِ · انقر: اذهب إلى هناك · E: استخدم · Q: أعِد القطعة · اسحب: انظر حولك',
    'design.h.hint.touch': 'المس رفًّا، ثم المس المركبة · اسحب لتنظر حولك',

    // The racks
    'design.h.st.inst': 'رف الأجهزة العلمية',
    'design.h.st.inst.why': 'كل جهاز يخدم هدفًا علميًا. النجمة ★ تعني الهدف الرئيسي، وهو الذي ستنقله الأخبار.',
    'design.h.st.power': 'ركن الطاقة',
    'design.h.st.power.why': 'ضوء الشمس عند {planet} يساوي {pct}% مما يصل إلى الأرض. وزن الألواح 3.5 كغ لكل م². أما البطارية النووية RTG فتعمل في أي مكان، حتى في الظلام.',
    'design.h.st.comms': 'طاولة الاتصالات',
    'design.h.st.comms.why': 'البيانات التي تصل إلى الأرض تزيد مع مساحة الطبق وقوة الراديو. كلاهما يضيف كتلة، والراديو يستهلك الطاقة.',
    'design.h.st.brains': 'المسجّلات والحواسيب',
    'design.h.st.brains.why': 'المسجّل يحفظ العلم حين تغيب الأرض عن النظر. والحاسوب الثاني يتولى المهمة إذا تعطّل الأول.',
    'design.h.st.shield': 'الدروع الإشعاعية',
    'design.h.st.prop': 'الوقود والكبح',
    'design.h.st.launch': 'جدار الصواريخ',
    'design.h.st.launch.why': 'مجسمات بمقياس 1:25. الصواريخ الأكبر ترفع أكثر، وتكلف أكثر.',
    'design.h.st.tests': 'لوح خطة الاختبار',

    // Parts
    'design.h.panels': 'ألواح شمسية، {n} م²',
    'design.h.panels.n': '{kg} كغ · {w} واط عند {planet}',
    'design.h.panels.on': 'الألواح الشمسية: {n} م²',
    'design.h.rtg.blurb': 'حرارة البلوتونيوم تولّد الكهرباء في أي مكان، حتى بعيدًا عن الشمس.',
    'design.h.rtg.on': 'RTG × {n}',
    'design.h.rec.gbit': 'مسجّل {n} غيغابت',
    'design.h.rec.tbit': 'مسجّل 1 تيرابت',
    'design.h.margin': 'وقود احتياطي، +{n}%',
    'design.h.margin.n': '{kg} كغ من الوقود في المجموع',
    'design.h.tank': 'خزان الوقود',
    'design.h.bus': 'جسم المركبة',

    // Cards
    'design.h.close': 'إغلاق',
    'design.h.on': 'على المركبة',
    'design.h.inhand': 'بين يديك',
    'design.h.card.foot': 'التقط قطعة، ثم احملها إلى المركبة.',
    'design.h.card.paper': 'أوراق لا قطع: الاختيار يغيّر الخطة فورًا.',
    'design.h.craft.why': 'كل ما ركّبته على مركبتك. نزع قطعة يوفّر كتلة ومالًا، وقد يكلّفك علمًا.',
    'design.h.craft.noinst': 'لا أجهزة بعد: هذه المركبة لا تستطيع جمع أي علم.',
    'design.h.off': 'انزعها',
    'design.h.swap': 'استبدلها عند: {where}',
    'design.h.pv.if': 'إذا ركّبتها:',
    'design.h.pv.off': 'إذا نزعتها:',
    'design.h.pv.paper': 'إذا اخترتها:',
    'design.h.pv.on': 'موجودة على المركبة',
    'design.pv.power': '{d} واط طاقة فائضة',

    // Carrying
    'design.h.carry': 'بين يديك',
    'design.h.mount': 'ركّبها',
    'design.h.mountgo': 'احملها إلى المركبة',
    'design.h.back': 'أعِدها مكانها',
    'design.h.p.mount': 'ركّب {what}',
    'design.h.p.back': 'أعِد {what} إلى مكانها',
    'design.h.p.craft': 'انظر ما على المركبة',
    'design.h.p.open': 'افتح: {what}',

    // Tooltips
    'design.h.tip.pick': 'انقر لتلتقطها',
    'design.h.tip.station': 'انقر لتمشي إلى هناك',
    'design.h.tip.mount': 'انقر لتركّب {what}',
    'design.h.tip.off': 'انقر لتنزعها',
    'design.h.tip.craft': 'انقر لترى ما رُكّب عليها',

    // Notes in the footer
    'design.h.mounted': 'رُكّبت القطعة {what}. راقب كتلة الإطلاق والمتطلبات.',
    'design.h.took': 'نزعت {what}. أعِدها إلى رفّها، أو ركّبها من جديد.',
    'design.h.backon': 'عادت {what} إلى رفّها.',
    'design.h.already': '{what} موجودة على المركبة.',
    'design.h.locked': '{what} مقفلة. {how}',
    'design.h.rtg.all': 'كل بطاريات RTG الـ{n} مركّبة على المركبة.',
    'design.h.full': 'الأجنحة الشمسية ممتلئة: 120 م² هي أقصى ما تحمله هذه المركبة.',
    'design.h.walkup': 'امشِ إلى رفّ أو إلى المركبة، ثم اضغط E.',

    // Crew missions
    'design.cat.crew': 'سلامة الطاقم',
    'design.cat.crew.lede': 'أربعة أشخاص يركبون هذه المركبة. كل قطعة أمان تضيف كتلة على الصاروخ أن يرفعها.',
    'design.h.st.capsule': 'ركن الكبسولة',
    'design.h.st.capsule.why': 'كل ما يُبقي أربعة أشخاص أحياء: الدرع الحراري، والهواء والماء، وبرج الهروب، وملجأ العواصف. وكل ذلك يركب الصاروخ.',
    'design.h.capsule': 'كبسولة الطاقم',
    'design.h.sm': 'وحدة الخدمة',
  });

  // Money inside Arabic sentences: keep "$73M" in order (see the end of ar.js).
  const MONEY = /[+−-]?\$(?:\{\w+\}|\d[\d.,]*)(?:M|B)?/g;
  Object.keys(ar).forEach((k) => {
    if (k.startsWith('design.h.') && typeof ar[k] === 'string' && ar[k].includes('$') && !ar[k].includes('⁦')) ar[k] = ar[k].replace(MONEY, '⁦$&⁩');
  });
})();
