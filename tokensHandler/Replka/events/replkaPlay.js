module.exports = {
    name: 'messageCreate',
    async execute(message, client) {
     if (!message.author.bot) return;
     if (message.content.startsWith(`<@${client.user.id}>`)) {
     if (message.content.includes('لديك **15 ثانية** لإرسال')) {
      const regex = /\*\*(.*?)\*\*/g;
      const matches = message.content.match(regex);

     if (matches) {
  const results = matches.map(match => match.replace(/\*\*/g, ''));
  const getType = results[1];
  let type;
    switch (getType) {
      case 'اسم إنسان':
        type = 'human';
        break;
      case 'حيوان':
        type = 'animal';
        break;
      case 'نبات':
        type = 'plant';
        break;
      case 'جماد':
        type = 'object';
        break;
      case 'دولة':
        type = 'country';
        break;
    }
  const ltr = results[2];
  const data = {
        'أ': {
            human: 'أيوب',
            animal: 'أسد',
            plant: 'أناناس',
            object: 'أريكه',
            country: 'أفغانستان'
        },
        'ب': {
            human: 'بسمة',
            animal: 'بطة',
            plant: 'برقوق',
            object: 'باب',
            country: 'بولندا'
        },
        'ت': {
            human: 'تامر',
            animal: 'تمساح',
            plant: 'تفاح',
            object: 'تاج',
            country: 'تونس'
        },
        'ث': {
            human: 'ثري',
            animal: 'ثعلب',
            plant: 'ثوم',
            object: 'ثياب',
            country: 'لا يوجد'
        },
        'ح': {
            human: 'حاتم',
            animal: 'حوت',
            plant: 'حرنكش',
            object: 'حبر',
            country: 'لا يوجد'
        },
        'ج': {
            human: 'جمال',
            animal: 'جمل',
            plant: 'جرجير',
            object: 'جسر',
            country: 'جورجيا'
        },
        'خ': {
            human: 'خالد',
            animal: 'خروف',
            plant: 'خس',
            object: 'خاتم',
            country: 'لا يوجد'
        },
        'د': {
            human: 'داليا',
            animal: 'دب',
            plant: 'دراق',
            object: 'دبوس',
            country: 'دنمارك'
        },
        'ذ': {
            human: 'ذبيان',
            animal: 'ذباب',
            plant: 'ذرة',
            object: 'ذهب',
            country: 'لا يوجد'
        },
        'ر': {
            human: 'رامي',
            animal: 'راكون',
            plant: 'رمان',
            object: 'رمل',
            country: 'رومانيا'
        },
        'ز': {
            human: 'زين',
            animal: 'زرافة',
            plant: 'زنجبيل',
            object: 'زجاجة',
            country: 'زامبيا'
        },
        'س': {
            human: 'سامح',
            animal: 'سنجاب',
            plant: 'سمسم',
            object: 'سيارة',
            country: 'سوريا'
        },
        'ش': {
            human: 'شريف',
            animal: 'شبل',
            plant: 'شمام',
            object: 'شباك',
            country: 'شيلي'
        },
        'ص': {
            human: 'صابر',
            animal: 'صرصور',
            plant: 'صنوبر',
            object: 'صندوق',
            country: 'صومال'
        },
        'ض': {
            human: 'ضياء',
            animal: 'ضبع',
            plant: 'ضرم',
            object: 'ضرس',
            country: 'لا يوجد'
        },
        'ط': {
            human: 'طاهر',
            animal: 'طاووس',
            plant: 'طماطم',
            object: 'طاولة',
            country: 'لا يوجد'
        },
        'ظ': {
            human: 'ظاهر',
            animal: 'ظبي',
            plant: 'ظيان',
            object: 'ظرف',
            country: 'لا يوجد'
        },
        'ع': {
            human: 'عادل',
            animal: 'عصفور',
            plant: 'عنب',
            object: 'علبة',
            country: 'عمان'
        },
        'غ': {
            human: 'غيث',
            animal: 'غراب',
            plant: 'غدير',
            object: 'غرفة',
            country: 'غينيا'
        },
        'ف': {
            human: 'فارس',
            animal: 'فهد',
            plant: 'فراولة',
            object: 'فرن',
            country: 'فلسطين'
        },
        'ق': {
            human: 'قاسم',
            animal: 'قطة',
            plant: 'قرنبيط',
            object: 'قلعة',
            country: 'قطر'
        },
        'ك': {
            human: 'كامل',
            animal: 'كلب',
            plant: 'كيوي',
            object: 'كتاب',
            country: 'كوريا'
        },
        'ل': {
            human: 'لارا',
            animal: 'لاما',
            plant: 'ليمون',
            object: 'لعبة',
            country: 'لبنان'
        },
        'م': {
            human: 'مرام',
            animal: 'ماعز',
            plant: 'موز',
            object: 'مقص',
            country: 'مصر'
        },
        'ن': {
            human: 'ناصر',
            animal: 'نمر',
            plant: 'نعناع',
            object: 'نظارة',
            country: 'نيجيريا'
        },
        'ه': {
            human: 'هيثم',
            animal: 'هدهد',
            plant: 'هليون',
            object: 'هاتف',
            country: 'هولندا'
        },
        'و': {
            human: 'وسام',
            animal: 'وطواط',
            plant: 'ورس',
            object: 'ورقة',
            country: 'لا يوجد'
        },
        'ي': {
            human: 'ياسر',
            animal: 'يعسوب',
            plant: 'يانسون',
            object: 'يخت',
            country: 'يمن'
        },
    };
       const msg = data[ltr][type];
       const time = (msg.length * 325) + 825;
         await message.channel.sendTyping();
        setTimeout(async () => {
         await message.channel.send(msg);
          }, time);
        }
      }
    }
  },
};