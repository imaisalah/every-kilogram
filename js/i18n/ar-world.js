// Arabic strings for the world work (merged into SMD.i18nDicts.ar):
// the open HQ campus, its staff, the test hall and the speech cards.
(function () {
  const SMD = (globalThis.SMD = globalThis.SMD || {});
  SMD.i18nDicts = SMD.i18nDicts || {};
  const ar = (SMD.i18nDicts.ar = SMD.i18nDicts.ar || {});
  const mine = {
    // ---------- The staff (content/staff.js) ----------
    'staff.director.name': 'نادية فاروق',
    'staff.director.role': 'مديرة الطيران',
    'staff.director.from': 'القاهرة، مصر',
    'staff.director.hello': 'أدير غرفة التحكم بالمهمات. حين يحتاج شيء إلى قرارك، سأكون أول من يخبرك.',
    'staff.engineer.name': 'كوامي مينسا',
    'staff.engineer.role': 'كبير المهندسين',
    'staff.engineer.from': 'أكرا، غانا',
    'staff.engineer.hello': 'أبني مركباتك وأكسرها عمدًا في قاعة الاختبارات، حتى لا يكسرها الفضاء لاحقًا.',
    'staff.scientist.name': 'د. مريم صالح',
    'staff.scientist.role': 'عالمة المهمة',
    'staff.scientist.from': 'الإسكندرية، مصر',
    'staff.scientist.hello': 'أقرر ماذا نقيس. كل جهاز على مركبتك يجيب عن سؤال من أسئلتي.',
    'staff.budget.name': 'طارق منصور',
    'staff.budget.role': 'مسؤول الميزانية',
    'staff.budget.from': 'الأقصر، مصر',
    'staff.budget.hello': 'كل كيلوغرام يكلّف مالًا. أنا أمسك الحسابات، حتى نستطيع دفع ثمن المهمة التالية.',
    'staff.intern.name': 'عمر إدريس',
    'staff.intern.role': 'طالب متدرّب',
    'staff.intern.from': 'الخرطوم، السودان',
    'staff.intern.hello': 'أنا هنا طوال الصيف، وأريد أن أرى كل نافذة إطلاق. اسألني أين الكواكب!',
    'staff.outreach.name': 'آيكو تاناكا',
    'staff.outreach.role': 'مسؤولة التواصل مع الجمهور',
    'staff.outreach.from': 'أوساكا، اليابان',
    'staff.outreach.hello': 'أخبر العالم بما نفعل. العلم الجيد والأخبار الصادقة يبنيان سمعتنا.',

    // ---------- Campus: buildings, views, controls ----------
    'hq.b.tests': 'قاعة الاختبارات',
    'hq.b.tests.s': 'هزّ وسخّن واختبر',
    'hq.b.tests.none': 'لا شيء للاختبار بعد',
    'hq.b.pad.ready': '{name} جاهزة للطيران',
    'hq.b.pad.next': '{name}، {date}',
    'hq.w.map': 'خريطة المقر',
    'hq.w.walk': 'عُد إلى المشي',
    'hq.w.hint': 'امشِ: W A S D أو نقرة · انظر: اسحب أو Q E · تحدّث: E',
    'hq.w.hintTouch': 'المس لتمشي أو تتحدث · اسحب لتنظر · قرّب بإصبعين',
    'hq.w.mapHint': 'انقر مبنى لتمشي إليه وتدخله.',
    'hq.w.mapHintTouch': 'المس مبنى لتمشي إليه وتدخله.',
    'hq.w.talkKey': 'تحدّث',
    'hq.w.talkTo': 'تحدّث مع {name}، {role}',
    'hq.coachW.t': 'تجوّل في وكالتك',
    'hq.coachW.b': 'امشِ بالمفاتيح W A S D أو بنقرة، وادخل أي مبنى بالمشي إلى بابه. اقترب من الناس واضغط E: هم يعرفون خطوتك التالية.',
    'hq.coachW.bTouch': 'المس الأرض لتمشي والمس بابًا لتدخل. المس الناس لتتحدث معهم: هم يعرفون خطوتك التالية.',

    // ---------- Speech cards ----------
    'hq.w.tip': 'هل تعلم؟',
    'hq.w.source': 'المصدر',
    'hq.w.another': 'معلومة أخرى',
    'hq.w.news': 'آخر الأخبار: {text}',
    'hq.w.show': 'أرني {name}',
    'hq.w.books': 'أرني حسابات {name}',
    'hq.w.results': 'اعرض نتائج {name}',
    'hq.w.goResearch': 'اذهب إلى مختبر الأبحاث',
    'hq.w.goArchive': 'زُر أرشيف الاكتشافات',
    'hq.w.goMap': 'أرني ذلك على خريطة النظام الشمسي',
    'hq.w.visitTests': 'زُر قاعة الاختبارات',
    'hq.w.runTests': 'شغّل الاختبارات',
    'hq.w.hire': 'وظِّف فريقًا ({m})',
    'hq.w.choose': 'أي مركبة تدخل للاختبار؟',
    'hq.w.phase': 'المرحلة {ph}',
    'hq.w.noTests': 'لا شيء للاختبار بعد. تصل المركبة إلى قاعة الاختبارات في المرحلة C، بعد مراجعة التصميم الأولي.',
    'hq.w.eng.empty': 'الغرفة النظيفة فارغة. اختر مهمة من لوحة المهمات، ويبدأ فريقي البناء.',
    'hq.w.eng.proj': '{name} في المرحلة {ph}، {phase}. التالي: {what}، {when}.',
    'hq.w.eng.proj0': '{name} في المرحلة {ph}، {phase}.',
    'hq.w.eng.test': 'إنها جاهزة لقاعة الاختبارات. نهزّها ونسخّنها ونجمّدها هنا، حتى لا يفاجئنا الفضاء.',
    'hq.w.eng.testLater': 'بعد مراجعة التصميم الأولي تنتقل إلى المرحلة C. عندها نستطيع اختبارها في قاعة الاختبارات.',
    'hq.w.sci.can': 'لدينا {n} نقطة علمية. هذا يكفي لـ«{tech}».',
    'hq.w.sci.save': 'لدينا {n} نقطة علمية. كل مهمة تعيد بيانات تكسبنا المزيد.',
    'hq.w.sci.disc': 'كشفت مركباتنا حتى الآن {n} من اكتشافات ناسا الحقيقية.',
    'hq.w.sci.disc0': 'لا اكتشافات بعد. أول نتائج جيدة ستفتح لنا صورًا حقيقية من ناسا.',
    'hq.w.bud.bank': 'لدينا {m} في البنك.',
    'hq.w.bud.broke': 'نفد مالنا. يتوقف البناء حتى تصل الميزانية الجديدة في يناير.',
    'hq.w.bud.low': 'لم يبقَ لـ{name} من الاحتياطي إلا {m}. أي تجاوز سيُدفع من ميزانيتنا نحن.',
    'hq.w.bud.ok': 'كل مشروع ما زال يملك احتياطيه. هذا هو المال الذي نحفظه للمفاجآت.',
    'hq.w.int.open': 'نافذة الإطلاق إلى {planet} مفتوحة الآن، حتى {date}! الكواكب لا تصطف هكذا إلا من حين لآخر.',
    'hq.w.int.next': 'نافذة الإطلاق التالية إلى {planet}: تُفتح {date}، {when}. إن فاتتك فعليك انتظار التي بعدها.',
    'hq.w.int.none': 'لا نوافذ أخرى إلى الكواكب قبل 2037. ما زالت مهمات الأرض والقمر ممكنة.',
    'hq.w.out.rep': 'سمعتنا {n} نجوم، ولدينا {h} من 3 مهمات رئيسية.',
    'hq.w.out.unlock': 'عند سمعة {n} تُفتح مهمة «{m}».',
    'hq.w.out.news': 'الجميع يتحدث عن هذا: {text}',
  };

  // Money inside Arabic sentences: keep "$73M" in order (same rule as ar.js).
  const MONEY = /[+−-]?\$(?:\{\w+\}|\d[\d.,]*)(?:M|B)?/g;
  Object.keys(mine).forEach((k) => {
    if (mine[k].includes('$')) mine[k] = mine[k].replace(MONEY, '⁦$&⁩');
  });
  Object.assign(ar, mine);
})();
