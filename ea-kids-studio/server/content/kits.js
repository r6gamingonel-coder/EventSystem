// Offline lesson kits: curated, simple, age-appropriate Arabic (with English for colours & numbers).
// These produce a complete package with zero API cost and are the safe baseline when no LLM is configured.
// Every kit lists the factual claims it makes so a human can verify them (factCheck).
import { COLOR_WORDS } from '../art/palette.js';
import { ANIMALS_DEF } from '../art/animals.js';
import { CHARACTERS } from '../art/characters.js';

// Grammatical gender per character (for past-tense verbs in Arabic).
const G = { rayyan: 'm', nunu: 'f', sallouma: 'f', zaqzaq: 'm' };
export const cn = (slug) => CHARACTERS[slug].nameAr;
export const found = (slug) => (G[slug] === 'f' ? 'وجدت' : 'وجد');
const NUM_AR = ['واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة', 'عشرة'];
const NUM_EN = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const DIGIT_AR = ['١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩', '١٠'];

// ----------------------------------------------------------------------------- colours
const COLORS = [
  { key: 'red', prop: 'apple', char: 'rayyan', found: 'تفاحة حمراء', is: 'التفاحة حمراء', en: { found: 'an apple', is: 'The apple is' } },
  { key: 'blue', prop: 'drop', char: 'nunu', found: 'قطرة ماء زرقاء', is: 'قطرة الماء زرقاء', en: { found: 'a water drop', is: 'The water drop is' } },
  { key: 'yellow', prop: 'banana', char: 'zaqzaq', found: 'موزة صفراء', is: 'الموزة صفراء', en: { found: 'a banana', is: 'The banana is' } },
  { key: 'green', prop: 'leaf', char: 'sallouma', found: 'ورقة شجر خضراء', is: 'ورقة الشجر خضراء', en: { found: 'a leaf', is: 'The leaf is' } },
  { key: 'orange', prop: 'orange', char: 'rayyan', found: 'برتقالة برتقالية', is: 'البرتقالة برتقالية', en: { found: 'an orange', is: 'The orange is' } },
  { key: 'pink', prop: 'flower', char: 'nunu', found: 'وردة وردية', is: 'الوردة وردية', en: { found: 'a flower', is: 'The flower is' } },
  { key: 'purple', prop: 'grapes', char: 'sallouma', found: 'عنبًا بنفسجيًا', is: 'العنب بنفسجي', en: { found: 'some grapes', is: 'The grapes are' } },
];

const colorsKit = {
  id: 'colors', category: 'colors', thumbnail: 'colors', languages: ['ar', 'en'],
  title: { ar: 'نتعلم الألوان مع أصدقاء الحيوانات', en: 'Learn Colors with Animal Friends' },
  objective: { ar: 'أن يتعرّف الطفل على الألوان الأساسية ويربط كل لون بشيء مألوف ويقول اسمه.', en: 'Children recognise basic colours, link each one to a familiar object and say its name.' },
  outcomes: { ar: ['يسمّي الألوان: أحمر، أزرق، أصفر، أخضر، برتقالي…', 'يربط اللون بشيء من حياته اليومية.'], en: ['Names basic colours.', 'Links each colour to an everyday object.'] },
  facts: ['الألوان المعروضة (أحمر، أزرق، أصفر، أخضر، برتقالي، وردي، بنفسجي) مع أمثلة تقليدية للأشياء المرتبطة بها.'],
  items: (lang, count) => COLORS.slice(0, count).map((c) => {
    const w = COLOR_WORDS[c.key];
    const host = c.char;
    const ar = [`هذا اللون ${w.ar}.`, `${cn(host)} ${found(host)} ${c.found}.`, `${c.is}!`, `قولوا معي: ${w.ar}!`].join(' ');
    const en = `This is the color ${w.en.toLowerCase()}. ${CHARACTERS[host].nameEn} found ${c.en.found}. ${c.en.is} ${w.en.toLowerCase()}! Say it with me: ${w.en.toLowerCase()}!`;
    return {
      title: `${w.ar} / ${w.en}`, narration: lang === 'en' ? en : ar, host, prop: c.prop, bg: 'tint', tint: w.light, word: lang === 'en' ? w.en : w.ar, wordColor: w.hex, sfx: 'pop', emotion: 'happy',
    };
  }),
  intro: { ar: 'أهلًا يا أصدقائي! أنا ريّان. اليوم سنتعلّم الألوان مع أصدقاء الحيوانات. هيا بنا!', en: 'Hello friends! I am Rayyan. Today we will learn colors with our animal friends. Let us begin!' },
  recap: (items, lang) => lang === 'en' ? `What a colorful day! We learned: ${items.map((i) => i.word.toLowerCase()).join(', ')}. Can you remember every color?`
    : `ما أجمل الألوان! تعلّمنا اليوم: ${items.map((i) => i.word).join('، ')}. هل تتذكّرون كل لون؟`,
  outro: { ar: 'شكرًا لأنكم تعلّمتم معنا! إلى اللقاء يا أصدقائي!', en: 'Thank you for learning with us! See you next time, friends!' },
  tags: ['تعليم الأطفال', 'الألوان', 'تعلم الألوان للأطفال', 'Learn colors', 'kids learning', 'Arabic for kids'],
  playlist: 'الألوان والأشكال',
};

// ----------------------------------------------------------------------------- numbers
const numbersKit = {
  id: 'numbers', category: 'numbers', thumbnail: 'numbers', languages: ['ar', 'en'],
  title: { ar: 'نعدّ معًا من ١ إلى ٥ مع نونو', en: 'Let Us Count with Nunu' },
  objective: { ar: 'أن يعدّ الطفل الأشياء ويربط الرقم باسمه وبالكمية.', en: 'Children count objects and connect each numeral with its name and quantity.' },
  outcomes: { ar: ['يعدّ حتى الرقم المختار.', 'يربط الرقم بعدد الأشياء.'], en: ['Counts up to the chosen number.', 'Connects numeral and quantity.'] },
  facts: ['أسماء الأعداد من واحد إلى عشرة وأرقامها الهندية (١، ٢، ٣…).'],
  items: (lang, count) => Array.from({ length: Math.min(count, 10) }, (_, i) => {
    const n = i + 1;
    const seq = (lang === 'en' ? NUM_EN : NUM_AR).slice(0, n).join(lang === 'en' ? ', ' : '، ');
    const prop = ['star', 'apple', 'balloon', 'fish'][i % 4];
    const things = { star: ['نجمة', 'star'], apple: ['تفاحة', 'apple'], balloon: ['بالونة', 'balloon'], fish: ['سمكة', 'fish'] }[prop];
    return {
      title: `${DIGIT_AR[i]} — ${NUM_AR[i]}`, host: 'nunu', prop, copies: n, bg: i % 2 ? 'meadow' : 'sunrise', word: lang === 'en' ? String(n) : DIGIT_AR[i], wordColor: '#FFFFFF', sfx: 'pop',
      narration: lang === 'en'
        ? `How many ${things[1]}s are here? Let us count together: ${seq}. The number is ${NUM_EN[i]}!`
        : `كم ${things[0]} هنا؟ نعدّ معًا: ${seq}. إذن العدد ${NUM_AR[i]}!`,
    };
  }),
  intro: { ar: 'أهلًا يا أصدقائي! أنا نونو. هيا نعدّ معًا!', en: 'Hello friends! I am Nunu. Let us count together!' },
  recap: (items, lang) => (lang === 'en' ? `Great counting! You can count to ${items.length}.` : `أحسنتم! أصبحتم تعدّون حتى ${NUM_AR[items.length - 1]}.`),
  outro: { ar: 'عدٌّ ممتع! إلى اللقاء يا أصدقائي!', en: 'That was fun counting! Goodbye, friends!' },
  tags: ['تعليم الأطفال', 'الأرقام', 'العد للأطفال', 'Counting for kids', 'Arabic numbers'],
  playlist: 'الأرقام والعدّ',
};

// ----------------------------------------------------------------------------- Arabic alphabet (letters that have art)
const LETTERS = [
  { l: 'أ', name: 'ألف', word: 'أرنب', char: 'nunu' }, { l: 'ب', name: 'باء', word: 'بالون', prop: 'balloon' },
  { l: 'ت', name: 'تاء', word: 'تفاحة', prop: 'apple' }, { l: 'ج', name: 'جيم', word: 'جزرة', prop: 'carrot' },
  { l: 'ز', name: 'زاي', word: 'زهرة', prop: 'flower' }, { l: 'س', name: 'سين', word: 'سمكة', prop: 'fish' },
  { l: 'ش', name: 'شين', word: 'شمس', prop: 'sun' }, { l: 'ع', name: 'عين', word: 'عنب', prop: 'grapes' },
  { l: 'ف', name: 'فاء', word: 'فراولة', prop: 'strawberry' }, { l: 'ق', name: 'قاف', word: 'قلب', prop: 'heart' },
  { l: 'ك', name: 'كاف', word: 'كرة', prop: 'ball' }, { l: 'م', name: 'ميم', word: 'موزة', prop: 'banana' },
  { l: 'ن', name: 'نون', word: 'نجمة', prop: 'star' },
];
const alphabetKit = {
  id: 'alphabet_ar', category: 'alphabet', thumbnail: 'alphabet', languages: ['ar'],
  title: { ar: 'نتعلّم الحروف العربية مع زقزق', en: 'Learn Arabic Letters with Zaqzaq' },
  objective: { ar: 'أن يتعرّف الطفل على شكل الحرف واسمه وكلمة تبدأ به.', en: 'Children recognise a letter’s shape, name and a word that begins with it.' },
  outcomes: { ar: ['يسمّي الحرف.', 'يذكر كلمة تبدأ بالحرف.'], en: ['Names the letter.', 'Gives a word starting with it.'] },
  facts: ['أسماء الحروف والكلمات المصاحبة لها. ملاحظة: هذه الحزمة تغطي الحروف التي تتوفر لها رسوم فقط.'],
  items: (_lang, count) => LETTERS.slice(0, count).map((x, i) => ({
    title: `حرف ${x.name}`, host: 'zaqzaq', prop: x.prop, char2: x.char, bg: 'tint', tint: ['#D6E9FF', '#FFE2C2', '#D4F5DF', '#FFDCEA', '#E6DAFF'][i % 5], word: x.l, wordColor: '#FFFFFF', sfx: 'chime',
    narration: `هذا حرف ${x.name}. ${x.name} مثل ${x.word}. قولوا معي: ${x.name}، ${x.word}!`,
  })),
  intro: { ar: 'أهلًا يا أصدقائي! أنا زقزق. هيا نتعلّم الحروف!', en: '' },
  recap: (items) => `أحسنتم! تعلّمنا اليوم ${items.length === 1 ? 'حرفًا' : 'حروفًا'} جميلة: ${items.map((i) => i.word).join('، ')}.`,
  outro: { ar: 'إلى اللقاء يا أصدقائي! نلتقي مع حروف جديدة.', en: '' },
  tags: ['الحروف العربية', 'تعليم الأطفال', 'الأبجدية', 'Arabic alphabet for kids'],
  playlist: 'الحروف العربية',
};

// ----------------------------------------------------------------------------- shapes
const SHAPES = [
  { prop: 'circle', ar: 'دائرة', fact: 'مستديرة وليس لها زوايا', like: 'الكرة تشبه الدائرة', extra: 'ball' },
  { prop: 'square', ar: 'مربع', fact: 'له أربعة أضلاع متساوية', like: 'هل تجدون شيئًا مربعًا حولكم؟' },
  { prop: 'triangle', ar: 'مثلث', fact: 'له ثلاثة أضلاع وثلاث زوايا', like: 'انظروا كم هو مدبّب!' },
  { prop: 'rectangle', ar: 'مستطيل', fact: 'له أربعة أضلاع، كل ضلعين متقابلين متساويان', like: 'الكتاب يشبه المستطيل', extra: 'book' },
  { prop: 'star', ar: 'نجمة', fact: 'لها خمسة رؤوس مدببة', like: 'ما أجمل النجوم في السماء!' },
  { prop: 'heart', ar: 'قلب', fact: 'شكل نحبّه كثيرًا', like: 'نرسمه عندما نحب أحدًا' },
  { prop: 'diamond', ar: 'معيّن', fact: 'له أربعة أضلاع متساوية', like: 'يشبه المربع المائل' },
];
const shapesKit = {
  id: 'shapes', category: 'shapes', thumbnail: 'shapes', languages: ['ar'],
  title: { ar: 'نتعلّم الأشكال مع سلّومة', en: 'Learn Shapes with Sallouma' },
  objective: { ar: 'أن يتعرّف الطفل على الأشكال الهندسية البسيطة ويسمّيها.', en: 'Children identify and name simple shapes.' },
  outcomes: { ar: ['يسمّي الدائرة والمربع والمثلث والمستطيل.', 'يلاحظ عدد الأضلاع.'], en: ['Names basic shapes.', 'Notices the number of sides.'] },
  facts: ['خصائص الأشكال: عدد الأضلاع والزوايا (الدائرة بلا زوايا، المربع أربعة أضلاع متساوية، المثلث ثلاثة أضلاع، المستطيل أضلاعه المتقابلة متساوية، النجمة الخماسية خمسة رؤوس).'],
  items: (_l, count) => SHAPES.slice(0, count).map((s, i) => ({
    title: `${s.ar}`, host: 'sallouma', prop: s.prop, bg: 'tint', tint: ['#FFE2C2', '#D6E9FF', '#D4F5DF', '#E6DAFF', '#FFF0B3', '#FFDCEA', '#FFDCEA'][i % 7], word: s.ar, wordColor: '#FFFFFF', sfx: 'pop',
    narration: `هذا شكل يُسمّى ${s.ar}. ال${s.ar} ${s.fact}. ${s.like}. قولوا معي: ${s.ar}!`,
  })),
  intro: { ar: 'مرحبًا يا أصدقائي! أنا سلّومة. اليوم سنتعرّف على الأشكال.', en: '' },
  recap: (items) => `رائع! تعلّمنا الأشكال: ${items.map((i) => i.word).join('، ')}.`,
  outro: { ar: 'إلى اللقاء يا أصدقائي! ابحثوا عن الأشكال حولكم.', en: '' },
  tags: ['الأشكال للأطفال', 'تعليم الأطفال', 'Shapes for kids'],
  playlist: 'الألوان والأشكال',
};

// ----------------------------------------------------------------------------- animals & sounds
const AG = { cat: 'f', dog: 'm', cow: 'f', duck: 'f', sheep: 'm', frog: 'm' };
const animalsKit = {
  id: 'animals_sounds', category: 'animals', thumbnail: 'animals', languages: ['ar'],
  title: { ar: 'أصوات الحيوانات مع ريّان', en: 'Animal Sounds with Rayyan' },
  objective: { ar: 'أن يتعرّف الطفل على حيوانات مألوفة وأصواتها.', en: 'Children recognise familiar animals and their sounds.' },
  outcomes: { ar: ['يسمّي الحيوان.', 'يقلّد صوته.'], en: ['Names the animal.', 'Imitates its sound.'] },
  facts: ['أصوات الحيوانات الشائعة (القطة تموء، الكلب ينبح، البقرة تخور، الخروف يثغو، الضفدع ينقّ). كتابة الأصوات بالحروف تقريبية.'],
  items: (_l, count) => Object.entries(ANIMALS_DEF).slice(0, count).map(([k, a]) => ({
    title: a.nameAr, animal: k, host: 'rayyan', bg: k === 'frog' ? 'forest' : 'meadow', word: a.nameAr.replace(/^ال/, ''), wordColor: '#FFFFFF', sfx: 'pop',
    narration: `${AG[k] === 'f' ? 'هذه' : 'هذا'} ${a.nameAr}. ${a.nameAr} ${a.verbAr}: ${a.soundAr}! هل تقلّدون صوتها؟ ${a.soundAr}!`,
  })),
  intro: { ar: 'أهلًا يا أصدقائي! أنا ريّان الأسد الصغير. هيا نتعرّف على أصوات الحيوانات!', en: '' },
  recap: (items) => `ما أجمل أصوات الحيوانات! تعرّفنا على: ${items.map((i) => i.title).join('، ')}.`,
  outro: { ar: 'إلى اللقاء يا أصدقائي! ريّان يحبكم.', en: '' },
  tags: ['أصوات الحيوانات', 'الحيوانات للأطفال', 'تعليم الأطفال', 'Animal sounds for kids'],
  playlist: 'الحيوانات',
};

// ----------------------------------------------------------------------------- good habits
const HABITS = [
  { title: 'غسل اليدين', prop: 'soap', prop2: 'bubble', host: 'sallouma', text: 'قبل الأكل وبعد اللعب نغسل أيدينا بالماء والصابون. فنصبح نظيفين ومرتاحين.', word: 'نغسل أيدينا', bg: 'classroom' },
  { title: 'تفريش الأسنان', prop: 'toothbrush', prop2: 'tooth', host: 'rayyan', text: 'نفرّش أسناننا بالفرشاة كل يوم. فتبقى أسناننا نظيفة وابتسامتنا جميلة.', word: 'نفرّش أسناننا', bg: 'classroom' },
  { title: 'شرب الماء', prop: 'drop', host: 'nunu', text: 'نشرب الماء كل يوم لأن أجسامنا تحتاج إليه.', word: 'نشرب الماء', bg: 'meadow' },
  { title: 'المشاركة', prop: 'gift', host: 'zaqzaq', text: 'عندما نشارك ألعابنا مع أصدقائنا، يفرحون ونفرح معهم.', word: 'نشارك', bg: 'meadow' },
  { title: 'من فضلك وشكرًا', prop: 'heart', host: 'nunu', text: 'نقول من فضلك عندما نطلب شيئًا. ونقول شكرًا عندما يساعدنا أحد.', word: 'شكرًا', bg: 'sunrise' },
  { title: 'ترتيب الألعاب', prop: 'book', host: 'sallouma', text: 'بعد اللعب نرتّب ألعابنا ونعيدها إلى مكانها. فتصبح غرفتنا جميلة.', word: 'نرتّب', bg: 'classroom' },
];
const habitsKit = {
  id: 'habits', category: 'habits', thumbnail: 'habits', languages: ['ar'],
  title: { ar: 'عادات جميلة مع أصدقاء الحيوانات', en: 'Good Habits with Animal Friends' },
  objective: { ar: 'أن يتعلّم الطفل عادات صحية وسلوكًا لطيفًا: النظافة، المشاركة، والأدب.', en: 'Children learn healthy habits and kind behaviour.' },
  outcomes: { ar: ['يعرف متى يغسل يديه.', 'يمارس المشاركة والكلمات اللطيفة.'], en: ['Knows when to wash hands.', 'Practises sharing and polite words.'] },
  facts: ['إرشادات عامة عن النظافة الشخصية وشرب الماء. يُنصح بمراجعتها مع مصدر صحي موثوق (وزارة الصحة / منظمة الصحة العالمية) قبل النشر.'],
  items: (_l, count) => HABITS.slice(0, count).map((h) => ({ title: h.title, host: h.host, prop: h.prop, prop2: h.prop2, bg: h.bg, word: h.word, wordColor: '#FFFFFF', sfx: 'chime', narration: `${h.title}. ${h.text} هل تفعلون ذلك مثلنا؟` })),
  intro: { ar: 'أهلًا يا أصدقائي! اليوم سنتعلّم عادات جميلة تجعلنا أصحّاء ولطفاء.', en: '' },
  recap: () => 'أحسنتم! العادات الجميلة تجعلنا سعداء وأقوياء.',
  outro: { ar: 'إلى اللقاء يا أصدقائي! كونوا لطفاء دائمًا.', en: '' },
  tags: ['عادات جميلة للأطفال', 'النظافة للأطفال', 'تعليم الأطفال', 'Good habits for kids'],
  playlist: 'العادات الجميلة',
};

// ----------------------------------------------------------------------------- nature: how plants grow
const NATURE = [
  { title: 'النبتة الصغيرة', prop: 'leaf', host: 'sallouma', text: 'كل نبتة كبيرة بدأت صغيرة جدًا. تبدأ كثير من النباتات من بذرة.', word: 'بذرة', bg: 'forest' },
  { title: 'الماء', prop: 'drop', host: 'sallouma', text: 'النبتة تحتاج إلى الماء لتنمو. نسقيها قليلًا من الماء، لا كثيرًا.', word: 'ماء', bg: 'meadow' },
  { title: 'الضوء', prop: 'sun', host: 'sallouma', text: 'النبتة تحتاج أيضًا إلى ضوء الشمس لتنمو.', word: 'ضوء', bg: 'sunrise' },
  { title: 'تكبر النبتة', prop: 'flower', host: 'sallouma', text: 'مع الماء والضوء، تكبر النبتة يومًا بعد يوم، وقد تصبح زهرة جميلة.', word: 'تكبر', bg: 'meadow' },
  { title: 'الشجرة', prop: 'tree', host: 'sallouma', text: 'بعض النباتات تصبح أشجارًا كبيرة. وتعيش الطيور في الأشجار.', word: 'شجرة', bg: 'forest' },
];
const natureKit = {
  id: 'nature_plants', category: 'nature', thumbnail: 'nature', languages: ['ar'],
  title: { ar: 'كيف تنمو النباتات؟ مع سلّومة', en: 'How Do Plants Grow? with Sallouma' },
  objective: { ar: 'أن يعرف الطفل أن النباتات تحتاج إلى الماء والضوء لتنمو.', en: 'Children learn that plants need water and light to grow.' },
  outcomes: { ar: ['يذكر حاجة النبات إلى الماء والضوء.'], en: ['States that plants need water and light.'] },
  facts: ['النباتات تحتاج إلى الماء وضوء الشمس لتنمو.', 'تبدأ كثير من النباتات من بذور (ليست كلها).', 'الطيور تعيش في الأشجار (بعض الطيور).'],
  items: (_l, count) => NATURE.slice(0, count).map((n) => ({ title: n.title, host: n.host, prop: n.prop, bg: n.bg, word: n.word, wordColor: '#FFFFFF', sfx: 'sparkle', narration: n.text })),
  intro: { ar: 'مرحبًا يا أصدقائي! أنا سلّومة. هل تعرفون كيف تنمو النباتات؟ هيا نكتشف معًا.', en: '' },
  recap: () => 'تعلّمنا أن النباتات تحتاج إلى الماء والضوء لتنمو. ما أجمل الطبيعة!',
  outro: { ar: 'إلى اللقاء يا أصدقائي! اعتنوا بالنباتات.', en: '' },
  tags: ['علوم للأطفال', 'النباتات', 'الطبيعة للأطفال', 'Plants for kids'],
  playlist: 'العلوم والطبيعة',
};

// ----------------------------------------------------------------------------- general knowledge: days of the week
const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const daysKit = {
  id: 'days_week', category: 'general', thumbnail: 'general', languages: ['ar'],
  title: { ar: 'أيام الأسبوع مع ريّان', en: 'Days of the Week with Rayyan' },
  objective: { ar: 'أن يحفظ الطفل أسماء أيام الأسبوع بالترتيب.', en: 'Children learn the names of the days in order.' },
  outcomes: { ar: ['يسمّي الأيام السبعة بالترتيب.'], en: ['Names the seven days in order.'] },
  facts: ['أيام الأسبوع السبعة بالعربية. يبدأ الترتيب هنا من الأحد (ويختلف أول الأسبوع بين البلدان).'],
  items: (_l, count) => DAYS.slice(0, count).map((d, i) => ({ title: d, host: ['rayyan', 'nunu', 'zaqzaq', 'sallouma'][i % 4], prop: ['sun', 'star', 'heart', 'flower', 'balloon', 'ball', 'cloud'][i], bg: ['meadow', 'sunrise', 'forest', 'meadow', 'sunrise', 'forest', 'meadow'][i], word: d, wordColor: '#FFFFFF', sfx: 'pop', narration: `اليوم ${['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع'][i]} في أسبوعنا هو يوم ${d}. قولوا معي: ${d}!` })),
  intro: { ar: 'أهلًا يا أصدقائي! هيا نتعلّم أيام الأسبوع السبعة.', en: '' },
  recap: (items) => `أيام الأسبوع هي: ${items.map((i) => i.word).join('، ')}.`,
  outro: { ar: 'إلى اللقاء يا أصدقائي! أسبوع سعيد.', en: '' },
  tags: ['أيام الأسبوع', 'تعليم الأطفال', 'Days of the week Arabic'],
  playlist: 'معلومات عامة',
};

// ----------------------------------------------------------------------------- story: sharing (original)
const storyKit = {
  id: 'story_sharing', category: 'story', thumbnail: 'story', languages: ['ar'], story: true,
  title: { ar: 'نونو والجزرة الكبيرة', en: 'Nunu and the Big Carrot' },
  objective: { ar: 'أن يتعلّم الطفل أن المشاركة تُفرح الجميع.', en: 'Children learn that sharing makes everyone happy.' },
  outcomes: { ar: ['يفهم معنى المشاركة.', 'يربط المشاركة بالفرح.'], en: [] },
  facts: ['قصة أصلية من تأليف EA KIDS؛ العبرة: المشاركة تُسعد الجميع.'],
  scenes: [
    { title: 'جزرة كبيرة', kind: 'story', bg: 'meadow', layers: [['prop', 'carrot', 0.7, 0.6, 0.55, 'float'], ['character', 'nunu', 0.27, 0.62, 0.68, 'bob', 'wow']], text: 'في صباح جميل، كانت نونو تلعب في المرج. فجأة وجدت جزرة كبيرة وجميلة!' },
    { title: 'نونو سعيدة', kind: 'story', bg: 'sunrise', layers: [['prop', 'carrot', 0.7, 0.6, 0.45, 'pulse'], ['character', 'nunu', 0.27, 0.62, 0.68, 'bob', 'love']], text: 'قالت نونو: ما أجمل هذه الجزرة! سأحملها إلى البيت.' },
    { title: 'زقزق جائع', kind: 'story', bg: 'meadow', layers: [['character', 'nunu', 0.27, 0.62, 0.6, 'none', 'happy'], ['character', 'zaqzaq', 0.74, 0.66, 0.5, 'slide_right', 'smile'], ['prop', 'carrot', 0.5, 0.78, 0.25, 'none']], text: 'في الطريق قابلت صديقها زقزق. كان زقزق حزينًا لأنه جائع ولا يجد طعامًا.' },
    { title: 'نونو تفكّر', kind: 'story', bg: 'meadow', layers: [['character', 'nunu', 0.3, 0.62, 0.68, 'wiggle', 'smile'], ['prop', 'cloud', 0.62, 0.22, 0.3, 'float'], ['prop', 'heart', 0.62, 0.22, 0.13, 'pulse']], text: 'فكّرت نونو قليلًا. ثم قالت: عندي جزرة كبيرة. هل تريد أن نتشاركها؟' },
    { title: 'نتشارك معًا', kind: 'story', bg: 'sunrise', layers: [['character', 'nunu', 0.27, 0.62, 0.62, 'bob', 'happy'], ['character', 'zaqzaq', 0.72, 0.66, 0.5, 'bob', 'love'], ['prop', 'carrot', 0.5, 0.8, 0.28, 'pulse']], text: 'قسمت نونو الجزرة نصفين، وأعطت زقزق نصفها. فرح زقزق كثيرًا وقال: شكرًا يا نونو!' },
    { title: 'العبرة', kind: 'recap', bg: 'meadow', layers: [['character', 'nunu', 0.25, 0.62, 0.6, 'bob', 'proud'], ['character', 'zaqzaq', 0.75, 0.66, 0.5, 'bob', 'proud'], ['text', '', 0.5, 0.14, 0.15, 'pop', '', 'المشاركة تُفرح الجميع']], text: 'أكلا معًا وضحكا كثيرًا. فالمشاركة تُفرح الجميع!' },
  ],
  tags: ['قصص للأطفال', 'قصة المشاركة', 'قصص تعليمية', 'Arabic kids story'],
  playlist: 'قصص تعليمية',
};

// ----------------------------------------------------------------------------- song: colours (original lyrics)
const songKit = {
  id: 'song_colors', category: 'songs', thumbnail: 'songs', languages: ['ar'], song: true,
  title: { ar: 'أغنية الألوان', en: 'The Colors Song' },
  objective: { ar: 'أن يردّد الطفل أسماء الألوان مع إيقاع بسيط.', en: 'Children chant colour names to a simple rhythm.' },
  outcomes: { ar: ['يردّد أسماء الألوان بإيقاع.'], en: [] },
  facts: ['كلمات أصلية من تأليف EA KIDS. اللحن مُولَّد داخليًا ولا يخضع لحقوق طرف ثالث.'],
  scenes: [
    { title: 'المقطع الأول', kind: 'song', bg: 'tint', tint: '#FFD6D6', layers: [['prop', 'apple', 0.72, 0.55, 0.5, 'bob'], ['character', 'rayyan', 0.25, 0.62, 0.66, 'bob', 'happy'], ['text', '', 0.5, 0.13, 0.17, 'pop', '#E5383B', 'أحمر']], text: 'أحمر أحمر، تفاحة حمراء!\nأحمر أحمر، ما أجملها!' },
    { title: 'المقطع الثاني', kind: 'song', bg: 'tint', tint: '#FFF0B3', layers: [['prop', 'banana', 0.72, 0.55, 0.5, 'bob'], ['character', 'zaqzaq', 0.25, 0.64, 0.6, 'bob', 'happy'], ['text', '', 0.5, 0.13, 0.17, 'pop', '#FFC400', 'أصفر']], text: 'أصفر أصفر، موزة صفراء!\nأصفر أصفر، ما ألذّها!' },
    { title: 'المقطع الثالث', kind: 'song', bg: 'tint', tint: '#D4F5DF', layers: [['prop', 'leaf', 0.72, 0.55, 0.5, 'bob'], ['character', 'sallouma', 0.25, 0.64, 0.6, 'bob', 'happy'], ['text', '', 0.5, 0.13, 0.17, 'pop', '#2EAD5B', 'أخضر']], text: 'أخضر أخضر، ورقة خضراء!\nأخضر أخضر، في الشجرة!' },
    { title: 'المقطع الرابع', kind: 'song', bg: 'tint', tint: '#D6E9FF', layers: [['prop', 'drop', 0.72, 0.55, 0.5, 'bob'], ['character', 'nunu', 0.25, 0.62, 0.66, 'bob', 'wink'], ['text', '', 0.5, 0.13, 0.17, 'pop', '#2F80ED', 'أزرق']], text: 'أزرق أزرق، قطرة زرقاء!\nأزرق أزرق، ما أصفاها!' },
  ],
  tags: ['أغاني أطفال', 'أغنية الألوان', 'تعليم الأطفال', 'Colors song Arabic'],
  playlist: 'أغانٍ تعليمية',
};

export const KITS = { colors: colorsKit, numbers: numbersKit, alphabet_ar: alphabetKit, shapes: shapesKit, animals_sounds: animalsKit, habits: habitsKit, nature_plants: natureKit, days_week: daysKit, story_sharing: storyKit, song_colors: songKit };
export const KIT_LIST = Object.values(KITS).map((k) => ({ id: k.id, category: k.category, languages: k.languages, title: k.title, maxItems: k.items ? k.items('ar', 99).length : (k.scenes?.length ?? 0), story: !!k.story, song: !!k.song }));
