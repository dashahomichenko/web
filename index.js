import { program } from 'commander';
import fs from 'fs';

// Налаштування програми та глобальної опції
program
  .name('rpg-cli')
  .description('Керування даними персонажів RPG-гри (Варіант 8)')
  .version('1.0.0')
  .option('-f, --file <path>', 'шлях до JSON-файлу з даними', 'data.json');

// Переклад стандартних помилок commander українською мовою
program.configureOutput({
  outputError: (str, write) => {
    if (str.includes('missing required argument')) {
      write('Помилка: Пропущено обовʼязковий аргумент! Перевірте довідку (--help).\n');
    } else if (str.includes('unknown option')) {
      write('Помилка: Вказано невідому опцію! Перевірте довідку (--help).\n');
    } else if (str.includes('option') && str.includes('argument missing')) {
      write('Помилка: Для опції не вказано значення!\n');
    } else if (str.includes('unknown command')) {
      write('Помилка: Невідома команда! Перевірте довідку (--help).\n');
    } else {
      write(`Помилка виклику: ${str}`);
    }
  }
});

// Допоміжна функція для читання та перевірки JSON-файлу
function loadData() {
  const filePath = program.opts().file;

  if (!fs.existsSync(filePath)) {
    console.error(`Помилка: Файл за шляхом "${filePath}" не знайдено!`);
    process.exit(1);
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Помилка: Файл "${filePath}" містить синтаксичну помилку (некоректний JSON)!`);
    process.exit(1);
  }
}

// Допоміжна функція для пошуку одного персонажа за ім'ям
function findHero(data, heroName) {
  const hero = data.find(item => item.name.toLowerCase() === heroName.toLowerCase());
  if (!hero) {
    console.error(`Помилка: Персонажа з імʼям "${heroName}" не знайдено!`);
    process.exit(1);
  }
  return hero;
}

// Загальні можливості

// Можливість "Перелік"
program
  .command('list')
  .description('Показати список персонажів')
  .option('-l, --limit <number>', 'обмежити кількість персонажів для виводу')
  .action((options) => {
    let heroes = loadData();

    if (options.limit !== undefined) {
      const limit = Number(options.limit);
      if (isNaN(limit) || !Number.isInteger(limit) || limit <= 0) {
        console.error('Помилка: Значення опції --limit має бути цілим додатним числом!');
        process.exit(1);
      }
      heroes = heroes.slice(0, limit);
    }

    if (heroes.length === 0) {
      console.log('Список персонажів порожній.');
      return;
    }

    heroes.forEach((hero, index) => {
      console.log(`${index + 1}. ${hero.name} | Роль: ${hero.role} | Рівень: ${hero.skill_level}`);
    });
  });

// Можливість "Один елемент"
program
  .command('get')
  .description('Показати повні дані одного персонажа за його імʼям')
  .argument('<name>', 'імʼя персонажа')
  .action((name) => {
    const heroes = loadData();
    const hero = findHero(heroes, name);
    console.log(JSON.stringify(hero, null, 2));
  });

// Можливість "Окреме поле"
program
  .command('field')
  .description('Показати значення окремого або вкладеного поля персонажа')
  .argument('<name>', 'імʼя персонажа')
  .argument('<path>', 'шлях до поля через крапку (наприклад, role, gear.helmet, inventory.0.item_name)')
  .action((name, path) => {
    const heroes = loadData();
    const hero = findHero(heroes, name);

    const keys = path.split('.');
    let current = hero;

    for (const key of keys) {
      if (current === null || typeof current !== 'object' || !(key in current)) {
        console.error(`Помилка: Поле "${path}" відсутнє у структурі даних персонажа ${hero.name}!`);
        process.exit(1);
      }
      current = current[key];
    }

    if (current === null) {
      console.log('null (поле існує в документі, але значення відсутнє)');
    } else if (typeof current === 'object') {
      console.log(JSON.stringify(current, null, 2));
    } else {
      console.log(current);
    }
  });


// Можливість "Рівень і характеристики персонажа"
program
  .command('stats')
  .description('Показати рівень та основні характеристики персонажа')
  .argument('<name>', 'імʼя персонажа')
  .action((name) => {
    const heroes = loadData();
    const hero = findHero(heroes, name);

    const friendText = hero.friend !== null ? hero.friend : 'немає (одинак)';
    const equippedGear = Object.entries(hero.gear)
      .filter(([, isWorn]) => isWorn)
      .map(([part]) => part);

    console.log(`=== Характеристики персонажа: ${hero.name} ===`);
    console.log(`Роль (клас):     ${hero.role}`);
    console.log(`Рівень:          ${hero.skill_level}`);
    console.log(`Досвід (XP):     ${hero.xp}`);
    console.log(`Вік:             ${hero.age}`);
    console.log(`Друг/союзник:    ${friendText}`);
    console.log(`Одягнена броня:  ${equippedGear.length > 0 ? equippedGear.join(', ') : 'відсутня'}`);
  });

// Можливість "Інвентар з відбором за призначенням та ознакою екіпірування"
program
  .command('inventory')
  .description('Показати інвентар персонажа з можливістю відбору за призначенням та екіпіруванням')
  .argument('<name>', 'імʼя персонажа')
  .option('-t, --type <type>', 'відбір за призначенням предмета (food, equipment, magic item)')
  .option('-e, --equipped', 'показати лише екіпіровані предмети')
  .option('-u, --unequipped', 'показати лише неекіпіровані предмети (у рюкзаку)')
  .action((name, options) => {
    if (options.equipped && options.unequipped) {
      console.error('Помилка: Не можна одночасно використовувати прапорці --equipped та --unequipped!');
      process.exit(1);
    }

    const heroes = loadData();
    const hero = findHero(heroes, name);
    let items = hero.inventory || [];

    if (options.type !== undefined) {
      const targetType = options.type.toLowerCase();
      items = items.filter(item => item.item_type.toLowerCase() === targetType);
    }

    if (options.equipped) {
      items = items.filter(item => item.is_equipped === true);
    } else if (options.unequipped) {
      items = items.filter(item => item.is_equipped === false);
    }

    if (items.length === 0) {
      console.log(`У персонажа ${hero.name} не знайдено предметів за вказаними критеріями.`);
      return;
    }

    console.log(`Інвентар персонажа ${hero.name}:`);
    items.forEach((item, index) => {
      const status = item.is_equipped ? '[Екіпіровано]' : '[У рюкзаку]';
      console.log(`${index + 1}. ${item.item_name} (x${item.item_quantity}) | Призначення: ${item.item_type} | ${status}`);
    });
  });

// Можливість "Відомості про обрану навичку"
program
  .command('skill')
  .description('Показати відомості про обрану навичку (заклинання) персонажа')
  .argument('<name>', 'імʼя персонажа')
  .argument('<skillName>', 'назва навички або її частина')
  .action((name, skillName) => {
    const heroes = loadData();
    const hero = findHero(heroes, name);
    const spells = hero.spells || [];

    if (spells.length === 0) {
      console.error(`Помилка: Персонаж ${hero.name} не має жодної вивченої навички!`);
      process.exit(1);
    }

    const foundIndex = spells.findIndex(s => s.toLowerCase().includes(skillName.toLowerCase()));

    if (foundIndex === -1) {
      console.error(`Помилка: Навичку "${skillName}" не знайдено у персонажа ${hero.name}! Доступні навички: ${spells.join(', ')}`);
      process.exit(1);
    }

    const matchedSkill = spells[foundIndex];
    console.log(`=== Відомості про навичку ===`);
    console.log(`Персонаж:         ${hero.name} (${hero.role})`);
    console.log(`Назва навички:    ${matchedSkill}`);
    console.log(`Слот у списку:    #${foundIndex + 1} (із ${spells.length})`);
    console.log(`Рівень майстра:   ${hero.skill_level} (XP: ${hero.xp})`);
    console.log(`Статус:           Вивчено та готово до використання`);
  });

program.parse();
