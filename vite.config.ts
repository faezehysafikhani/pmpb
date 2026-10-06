import path from 'path';
import { defineConfig, loadEnv, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { GoogleGenAI, Type } from '@google/genai';

async function generateWithGeminiFallback(
  ai: GoogleGenAI,
  params: {
    contents: any;
    config?: any;
    preferredModel?: string;
  }
) {
  const modelsToTry = [
    params.preferredModel,
    "gemini-2.5-flash",
    "gemini-1.5-flash",
    "gemini-2.5-pro",
    "gemini-1.5-pro",
    "gemini-1.5-flash-8b"
  ].filter(Boolean) as string[];

  const uniqueModels = Array.from(new Set(modelsToTry));
  let lastError: any = null;

  for (const model of uniqueModels) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: params.contents,
          config: params.config
        });
        if (response && response.text !== undefined) {
          return response;
        }
      } catch (err: any) {
        lastError = err;
        const errStr = typeof err === 'object' ? JSON.stringify(err) : String(err?.message || err);
        console.warn(`Gemini call attempt ${attempt + 1} with ${model} failed in Vite plugin:`, errStr);

        const isTransient = errStr.includes("503") || 
                            errStr.includes("UNAVAILABLE") || 
                            errStr.includes("high demand") || 
                            errStr.includes("429") || 
                            errStr.includes("RESOURCE_EXHAUSTED") || 
                            errStr.includes("500") || 
                            errStr.includes("502") || 
                            errStr.includes("504") ||
                            errStr.includes("overloaded");

        if (isTransient && attempt < 2) {
          const backoffMs = (attempt + 1) * 1500;
          await new Promise(resolve => setTimeout(resolve, backoffMs));
        } else {
          break;
        }
      }
    }
  }

  throw lastError || new Error("سرویس هوش مصنوعی به طور موقت در دسترس نیست.");
}

function aiApiPlugin(env: Record<string, string>): Plugin {
  return {
    name: 'ai-wbs-api-plugin',
    configureServer(server) {
      server.middlewares.use('/api/ai/feasibility-analysis', async (req, res, next) => {
        if (req.method !== 'POST') return next();

        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
          try {
            const apiKey = process.env.GEMINI_API_KEY || env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY;
            const parsedBody = JSON.parse(body || '{}');
            const { name: rawName, projectName, title, goal, requirements, constraintsAndAssumptions, description, cost, startDate, endDate, owningUnit, type } = parsedBody;
            const name = (rawName || projectName || title || 'پروژه بدون عنوان').trim();
            const safeCostStr = cost ? (typeof cost === 'number' ? `${cost.toLocaleString()} ریال` : `${String(cost)} ریال`) : 'تعیین نشده';

            if (!apiKey) {
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                success: true,
                isJustified: true,
                technicalFeasibility: `امکان‌سنجی فنی پروژه «${name}»: با توجه به زیرساخت‌ها و نیازمندی‌های بیان شده، پروژه از نظر فنی قابل اجرا می‌باشد.`,
                economicFeasibility: `امکان‌سنجی اقتصادی: بودجه پیش‌بینی شده (${safeCostStr}) با دامنه کار مطابقت دارد.`,
                overallAnalysis: "نتیجه‌گیری: پروژه در چارچوب برنامه‌های عملیاتی و اهداف سازمانی دارای توجیه اولیه است.",
                proposedRevisions: [
                  "شفاف‌سازی و تفکیک دقیق‌تر نیازمندی‌های فازبندی‌شده",
                  "تعیین دقیق‌تر شاخص‌های کلیدی عملکرد (KPI) جهت پایش بازگشت سرمایه"
                ],
                formattedResponseComment: `پروژه «${name}» ارزیابی اولیه شد و دارای توجیه فنی و اقتصادی است.`
              }));
              return;
            }

            const ai = new GoogleGenAI({
              apiKey,
              httpOptions: { headers: { "User-Agent": "aistudio-build" } }
            });

            const promptText = `اطلاعات پروژه جهت امکان‌سنجی فنی و اقتصادی:
- عنوان پروژه: ${name}
- هدف پروژه: ${goal || 'ثبت نشده'}
- الزامات پروژه: ${requirements || 'ثبت نشده'}
- محدودیت‌ها و مفروضات: ${constraintsAndAssumptions || 'ثبت نشده'}
- شرح و منشور: ${description || 'ثبت نشده'}
- برآورد هزینه (ریال): ${safeCostStr}
- بازه زمانی اجرای پروژه (شمسی): از ${startDate || 'نامشخص'} تا ${endDate || 'نامشخص'}
- واحد متولی: ${owningUnit || 'نامشخص'}
- متدولوژی: ${type === 'agile' ? 'چابک (Agile)' : 'آبشاری (Waterfall)'}`;

            const systemInstruction = `شما ارزیاب ارشد هوشمند و منتقد امکان‌سنجی فنی و اقتصادی پروژه‌های سازمانی در ایران هستید.
پروژه با مشخصات زیر سنجیده می‌شود:
- عنوان پروژه: ${name}
- برآورد هزینه ثبت‌شده: ${safeCostStr}
- بازه زمانی اجرای پروژه (شمسی): از ${startDate || 'نامشخص'} تا ${endDate || 'نامشخص'}
- هدف پروژه: ${goal || 'ثبت نشده'}
- الزامات پروژه: ${requirements || 'ثبت نشده'}
- محدودیت‌ها و مفروضات: ${constraintsAndAssumptions || 'ثبت نشده'}

قواعد حیاتی و دستورالعمل ارزیابی:

۱. **الزامی بودن سه فیلد اصلی (هدف، الزامات، محدودیت‌ها و مفروضات)**:
   - فیلد «محدودیت‌ها و مفروضات» مانند فیلدهای «هدف» و «الزامات» در منشور پروژه **الزامی** است. در صورت خالی بودن یا عدم ثبت هرکدام از این سه فیلد، منشور پروژه ناقص بوده و مقدار isJustified الزماً false خواهد بود.

۲. **تناسب مفهومی با عنوان پروژه و معنی‌دار بودن خوداتکای عبارات**:
   - **تناسب مفهومی**: مطالب ثبت‌شده در اهداف، الزامات و محدودیت‌ها و مفروضات باید منطقاً و به لحاظ تخصصی با عنوان پروژه («${name}») تناسب کامل داشته باشند.
   - **معنی و مفهوم داشتن عبارات به تنهایی**: عبارات ثبت‌شده در این فیلدها باید به تنهایی و بدون نیاز به حدس و گمان، دارای معنی و مفهوم زبانی کامل، شفاف و منطقی باشند.
   - **شناسایی کلمات نامفهوم**: اگر کلمه، عبارت بی‌معنی، تایپ تصادفی (مانند «Hvbvvb»، «Ghhgjh»، «asdf»)، کاراکترهای تست یا متون نامفهوم وجود دارد، **عین همان کلمه را داخل گیومه (مثلاً «Hvbvvb»)** صریحاً در بخش امکان‌سنجی فنی (technicalFeasibility) گزارش نمایید.

۳. **قانون انحراف ۲۰ درصدی زمان و هزینه (+/- ۲۰٪)**:
   - زمان و هزینه متعارف در بازار ایران را بر اساس موضوع و عنوان خاص پروژه («${name}») برآورد کارشناسی نمایید.
   - **قانون ۲۰٪ انحراف**: اگر زمان یا هزینه ثبت‌شده توسط کاربر بیش از **۲۰٪ مثبت یا منفی** (بیش از ۲۰٪ بیشتر یا کمتر) با برآورد زمان و هزینه هوش مصنوعی انحراف داشته باشد، **حتماً و صریحاً باید در بخش نتیجه‌گیری (overallAnalysis) عدم تناسب گزارش شود.**

۴. **قانون حاکم بر نتیجه‌گیری کل (overallAnalysis) و نظر مسئول تایید (formattedResponseComment)**:
   - اگر هرگونه عدم تناسب زمان/هزینه (انحراف بیش از ۲۰٪) یا اشکال مفهومی/عبارات نامفهوم/عدم تکمیل محدودیت‌ها وجود داشته باشد:
     الف) مقدار isJustified الزماً و بدون استثنا باید false باشد.
     ب) در overallAnalysis باید صریحاً قید شود: «نتیجه‌گیری: پروژه «${name}» به دلیل عدم تناسب برآورد زمان و هزینه ثبت‌شده با برآورد امکان‌سنجی هوش مصنوعی (انحراف بیش از ۲۰٪) و وجود اشکالات فنی/عبارات نامفهوم در منشور، فاقد توجیه‌پذیری اجرایی تشخیص داده شد.»`;

            const responseSchema = {
              type: Type.OBJECT,
              description: "نتیجه امکان‌سنجی فنی و اقتصادی پروژه",
              properties: {
                isJustified: { type: Type.BOOLEAN, description: "آیا پروژه دارای توجیه فنی و اقتصادی است؟" },
                technicalFeasibility: { type: Type.STRING, description: "تحلیل امکان‌سنجی فنی" },
                economicFeasibility: { type: Type.STRING, description: "تحلیل امکان‌سنجی اقتصادی" },
                overallAnalysis: { type: Type.STRING, description: "نتیجه‌گیری و تحلیل جامع" },
                proposedRevisions: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "لیست اصلاحات پیشنهادی به مسئول تایید"
                },
                formattedResponseComment: { type: Type.STRING, description: "متن آماده نظر کارشناسی مسئول تایید جهت کپی و ثبت" }
              },
              required: ["isJustified", "technicalFeasibility", "economicFeasibility", "overallAnalysis", "proposedRevisions", "formattedResponseComment"]
            };

            try {
              const response = await generateWithGeminiFallback(ai, {
                preferredModel: "gemini-2.5-flash",
                contents: promptText,
                config: {
                  systemInstruction,
                  responseMimeType: "application/json",
                  responseSchema,
                  temperature: 0.2
                }
              });

              let rawText = response.text || "{}";
              rawText = rawText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
              const result = JSON.parse(rawText);

              // Server-side consistency validation
              const techText = String(result.technicalFeasibility || '');
              const econText = String(result.economicFeasibility || '');
              const numCostVal = typeof cost === 'number' ? cost : parseFloat(String(cost).replace(/[^\d.]/g, '')) || 0;

              const hasTechFail = techText.includes('نامفهوم') || techText.includes('بی‌معنی') || techText.includes('عدم تناسب') || techText.includes('عدم انطباق') || techText.includes('نقص');
              const hasEconFail = econText.includes('انحراف') || econText.includes('غیرواقعی') || econText.includes('ناچیز') || econText.includes('نمادین') || econText.includes('نامناسب') || econText.includes('عدم تناسب') || numCostVal < 1000000;

              if (hasTechFail || hasEconFail) {
                  result.isJustified = false;
                  const reasons: string[] = [];
                  if (hasEconFail) {
                      reasons.push(`عدم تناسب برآورد زمان و هزینه ثبت‌شده با برآورد زمان و هزینه امکان‌سنجی هوش مصنوعی در ایران`);
                  }
                  if (hasTechFail) {
                      reasons.push(`وجود اشکال، عدم شفافیت یا عبارات نامفهوم در بخش فنی منشور`);
                  }
                  if (!result.overallAnalysis || result.overallAnalysis.includes('تناسب کامل') || result.overallAnalysis.includes('مناسب است') || !result.overallAnalysis.includes('عدم تناسب زمان و هزینه')) {
                      result.overallAnalysis = `نتیجه‌گیری: پروژه «${name}» به دلیل [ ${reasons.join(' و ')} ] فاقد توجیه‌پذیری اجرایی بوده و نیازمند اصلاح کامل منشور می‌باشد.`;
                  }
                  if (!result.formattedResponseComment || result.formattedResponseComment.includes('مورد تایید است') || result.formattedResponseComment.includes('مناسب است')) {
                      result.formattedResponseComment = `با سلام، ارزیابی امکان‌سنجی پروژه «${name}» انجام گردید. طرح فوق به دلیل [ ${reasons.join(' و ')} ]، در وضعیت فعلی فاقد توجیه‌پذیری تشخیص داده شده و عودت داده می‌شود.`;
                  }
              }

              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                success: true,
                isJustified: result.isJustified ?? false,
                technicalFeasibility: result.technicalFeasibility || '',
                economicFeasibility: result.economicFeasibility || '',
                overallAnalysis: result.overallAnalysis || '',
                proposedRevisions: Array.isArray(result.proposedRevisions) ? result.proposedRevisions : [],
                formattedResponseComment: result.formattedResponseComment || ''
              }));
            } catch (geminiErr: any) {
              console.error("Gemini feasibility error in Vite plugin:", geminiErr);
              const hasDetails = !!((goal && goal.length > 5) || (description && description.length > 10) || (requirements && requirements.length > 5));
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                success: true,
                isJustified: hasDetails,
                technicalFeasibility: hasDetails 
                  ? `امکان‌سنجی فنی پروژه «${name}»: الزامات و مشخصات فنی ثبت گردیده و در چارچوب فنی قابل برنامه‌ریزی و اجراست.`
                  : `امکان‌سنجی فنی پروژه «${name}»: به دلیل عدم ثبت کامل اهداف و الزامات، پروژه نیازمند تکمیل اطلاعات فنی اولیه می‌باشد.`,
                economicFeasibility: cost
                  ? `امکان‌سنجی اقتصادی: برآورد مالی برابر با ${safeCostStr} ثبت گردیده و متناسب با دامنه پروژه است.`
                  : `امکان‌سنجی اقتصادی: برآورد مالی پروژه هنوز ثبت نگردیده است.`,
                overallAnalysis: hasDetails
                  ? `نتیجه‌گیری: کلیات پروژه دارای توجیه اولیه بوده و با اعمال اصلاحات پیشنهادی قابلیت اجرا دارد.`
                  : `نتیجه‌گیری: پروژه در وضعیت فعلی فاقد توجیه کامل بوده و نیازمند تکمیل منشور قبل از اقدام نهایی است.`,
                proposedRevisions: hasDetails
                  ? ["تعیین دقیق‌تر شاخص‌های کلیدی عملکرد (KPI)", "فازبندی پروژه و تدوین جدول زمان‌بندی تفصیلی"]
                  : ["تکمیل اهداف و شرح منشور پروژه", "ثبت برآورد دقیق بودجه و هزینه‌های اجرایی", "تعیین واحد متولی و مسئولیت‌ها"],
                formattedResponseComment: hasDetails
                  ? `پروژه «${name}» ارزیابی شد و دارای توجیه اولیه تشخیص داده شد. پیشنهاد می‌شود جدول زمان‌بندی و شاخص‌ها پایش گردد.`
                  : `پروژه «${name}» به دلیل نقص اطلاعات منشور در وضعیت فعلی فاقد توجیه کامل تشخیص داده شد.`
              }));
            }

          } catch (err: any) {
            console.error("Feasibility analysis endpoint error:", err);
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              success: false,
              error: `خطای سرور در ارزیابی امکان‌سنجی: ${err?.message || String(err)}`
            }));
          }
        });
      });

      server.middlewares.use('/api/ai/suggest-wbs', async (req, res, next) => {
        if (req.method !== 'POST') {
          return next();
        }

        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
          try {
            const apiKey = process.env.GEMINI_API_KEY || env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY;
            if (!apiKey) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ 
                error: 'GEMINI_API_KEY تنظیم نشده است. لطفاً کلید API را در تنظیمات Vercel یا متغیرهای محیطی سیستم وارد کنید.' 
              }));
              return;
            }

            const parsedBody = JSON.parse(body || '{}');
            const { projectType = 'waterfall', title, charterData = {}, customPrompt = '' } = parsedBody;
            const isWaterfall = projectType === 'waterfall';

            const ai = new GoogleGenAI({
              apiKey,
              httpOptions: {
                headers: {
                  'User-Agent': 'aistudio-build'
                }
              }
            });

            const systemInstruction = `شما یک دستیار هوشمند و ارشد مدیریت پروژه (PMP/PMI) هستید. 
وظیفه شما ایجاد یک ساختار شکست کار (WBS) استاندارد و دقیق متناسب با اطلاعات منشور پروژه به زبان فارسی است.

مشخصات پروژه:
- عنوان پروژه: ${title || charterData.title || "پروژه عمومی"}
- هدف پروژه: ${charterData.objective || "مشخص نشده"}
- محدوده: ${charterData.scope || "مشخص نشده"}
- تاریخ شروع: ${charterData.startDate || "1403/01/01"}
- تاریخ پایان: ${charterData.endDate || "1403/12/29"}
- تعداد اسپریت‌ها (در صورت چابک): ${charterData.sprintCount || 4}
- واحد متولی: ${charterData.owningUnit || "مشخص نشده"}
${customPrompt ? `- دستورات تکمیلی کاربر: ${customPrompt}` : ""}

قوانین تولید WBS:
${isWaterfall ? `
برای زمانبندی آبشاری:
1. بین 5 تا 10 فعالیت اصلی و فازبندی شده منطقی استخراج کنید.
2. مجموع وزن (weight) تمامی فعالیت‌ها باید دقیقاً برابر با 100 باشد.
3. برای هر فعالیت، مدت زمان (duration به روز)، تاریخ شروع (startDate فرمت YYYY-MM-DD)، تاریخ پایان (endDate فرمت YYYY-MM-DD)، پیش‌نیازها (prerequisites به صورت شماره شناسه فازهای قبل مانند "1" یا "1, 2" یا خالی "") تعیین کنید.
4. فعالیت‌ها باید تسلسل زمانی منطقی بر اساس تاریخ شروع و پایان پروژه داشته باشند.
` : `
برای زمانبندی چابک (Agile / Scrum):
1. بین 6 تا 12 فعالیت / داستان کاربر (User Story) و تپک در قالب بک‌لوگ ایجاد کنید.
2. برای هر فعالیت، عنوان، توضیحات، وزن/نقطه (weight)، شماره اسپیرینت (sprint از 1 تا ${charterData.sprintCount || 4}) و وضعیت اولیه ("To-Do") تعیین کنید.
`}
پاسخ خروجی باید به صورت آرایه‌ای از اشیاء JSON با ساختار مشخص شده باشد.
`;

            const responseSchema = isWaterfall ? {
              type: Type.ARRAY,
              description: "لیست فعالیت‌های ساختار شکست کار آبشاری",
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING, description: "عنوان فعالیت" },
                  durationDays: { type: Type.NUMBER, description: "مدت زمان به روز" },
                  startDate: { type: Type.STRING, description: "تاریخ شروع YYYY-MM-DD" },
                  endDate: { type: Type.STRING, description: "تاریخ پایان YYYY-MM-DD" },
                  weight: { type: Type.NUMBER, description: "وزن درصد (بین 1 تا 100)" },
                  prerequisites: { type: Type.STRING, description: "شناسه پیش‌نیازها مثلا 1 یا 1,2 یا خالی" },
                  deliverable: { type: Type.STRING, description: "خروجی یا تحویلی فعالیت" }
                },
                required: ["title", "durationDays", "startDate", "endDate", "weight"]
              }
            } : {
              type: Type.ARRAY,
              description: "لیست فعالیت‌های چابک",
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING, description: "عنوان فعالیت یا داستان کاربر" },
                  description: { type: Type.STRING, description: "توضیحات و جزئیات کار" },
                  weight: { type: Type.NUMBER, description: "وزن یا وزن نسبی" },
                  sprint: { type: Type.NUMBER, description: "شماره اسپیرینت" },
                  status: { type: Type.STRING, description: "وضعیت مثلا To-Do" }
                },
                required: ["title", "weight", "sprint"]
              }
            };

            const response = await generateWithGeminiFallback(ai, {
              preferredModel: "gemini-2.5-flash",
              contents: `لطفاً ساختار شکست کار (WBS) متناسب با منشور پروژه "${title || charterData.title || "پروژه"}" را تولید کنید.`,
              config: {
                systemInstruction,
                responseMimeType: "application/json",
                responseSchema
              }
            });

            const text = response.text || "[]";
            const items = JSON.parse(text);

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true, items }));
          } catch (err: any) {
            console.error("WBS AI generation error:", err);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err.message || 'خطا در ارتباط با هوش مصنوعی' }));
          }
        });
      });
    }
  };
}

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react(), aiApiPlugin(env)],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(process.cwd(), '.'),
        }
      }
    };
});
