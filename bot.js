require('dotenv').config();
const { Telegraf } = require('telegraf');
const axios = require('axios');

// --- State and Cache ---
let allSkinsData = [];
const skinsByWeapon = {};
const SKINS_PER_PAGE = 8;
const priceCache = new Map();
const CACHE_DURATION_MS = 5 * 60 * 1000; // Cache results for 5 minutes.

// Language state management
const userLanguage = {}; // Stores user language preference { chatId: 'en' | 'ru' }

// --- NEW: Weapon Categorization ---
const weaponCategories = {
    en: {
        pistols: 'Pistols',
        smgs: 'SMGs',
        rifles: 'Rifles',
        heavy: 'Heavy',
        knives: 'Knives',
        gloves: 'Gloves'
    },
    ru: {
        pistols: 'Пистолеты',
        smgs: 'ПП',
        rifles: 'Винтовки',
        heavy: 'Тяжелое',
        knives: 'Ножи',
        gloves: 'Перчатки'
    }
};

const weapons = {
    pistols: ['Glock-18', 'P2000', 'USP-S', 'Dual Berettas', 'P250', 'Tec-9', 'Five-SeveN', 'CZ75-Auto', 'Desert Eagle', 'R8 Revolver'],
    smgs: ['MAC-10', 'MP9', 'MP7', 'MP5-SD', 'UMP-45', 'P90', 'PP-Bizon'],
    rifles: ['Galil AR', 'FAMAS', 'AK-47', 'M4A4', 'M4A1-S', 'SSG 08', 'SG 553', 'AUG', 'AWP', 'G3SG1', 'SCAR-20'],
    heavy: ['Nova', 'XM1014', 'Sawed-Off', 'MAG-7', 'M249', 'Negev'],
    knives: ['Bayonet', 'Bowie Knife', 'Butterfly Knife', 'Classic Knife', 'Falchion Knife', 'Flip Knife', 'Gut Knife', 'Huntsman Knife', 'Karambit', 'Kukri Knife', 'M9 Bayonet', 'Navaja Knife', 'Nomad Knife', 'Paracord Knife', 'Shadow Daggers', 'Skeleton Knife', 'Stiletto Knife', 'Survival Knife', 'Talon Knife', 'Ursus Knife'],
    gloves: ['Broken Fang Gloves', 'Driver Gloves', 'Hand Wraps', 'Hydra Gloves', 'Moto Gloves', 'Specialist Gloves', 'Sport Gloves']
};


// Centralized text for easy translation
const locales = {
    en: {
        welcome: '�​​🔮​ Hi, I\'m Dante. What can I do for you?​💎​',
        steam_prices_btn: '🔍 Steam Skin Prices',
        external_sites_btn: '🌐 External Sites',
        creator_profile_btn: '🎮 Creator\'s Profile',
        random_skin_btn: '🎲 Show Random Skin Price!',
        donations_btn: '💖 Donations',
        switch_lang_btn: '🇬🇧 / 🇷🇺 Switch Language',
        donations_text: 'You can support the project creator via this trade link. Thank you! 🙏',
        creator_steam_link_text: '🎮 Visit the creator\'s Steam:',
        external_sites_menu_title: '🌐 Choose an external site:',
        skinport_soon_btn: 'Skinport (soon!)',
        skinbaron_soon_btn: 'SkinBaron (soon!)',
        csfloat_soon_btn: 'CSFloat (soon!)',
        dmarket_soon_btn: 'DMarket (soon!)',
        feature_soon_alert: 'This feature is currently under construction!',
        back_btn: '🔙 Back',
        back_to_categories_btn: '🔙 Back to Categories',
        main_menu_btn: '🔙 Main Menu',
        choose_weapon_category: '🔫 Please choose a weapon category:',
        choose_weapon: '🔫 Please choose a weapon:',
        no_skins_found: '🤔 No skins found for',
        choose_skin_for: '🎨 Please choose a skin for',
        page: 'Page',
        searching_prices: '⏳ Searching for prices...',
        searching_prices_once: '⏳ Searching for prices (this is slow only the first time)...',
        skin_info_not_found: '❌ Skin info not found.',
        prices_in: '_Prices in USD ($) / EUR (€), fetched from Steam Market._',
        normal_prices: '*--- Normal ---*',
        stattrak_prices: '*--- StatTrak™ ---*',
        souvenir_prices: '*--- Souvenir ---*',
        show_normal_btn: '⬅️ Show Normal Prices',
        show_stattrak_btn: '⭐ Show StatTrak™ Prices',
        show_souvenir_btn: '🏆 Show Souvenir Prices',
        query_expired_log: "Caught a 'query is too old' error. This is expected if the user clicks while the bot is busy. Ignoring."
    },
    ru: {
        welcome: '👋​​🔮​ Привет, я Данте. Чем могу помочь?​💎​',
        steam_prices_btn: '🔍 Цены Steam',
        external_sites_btn: '🌐 Внешние сайты',
        creator_profile_btn: '🎮 Профиль создателя',
        random_skin_btn: '🎲 Случайный скин!',
        donations_btn: '💖 Пожертвования',
        switch_lang_btn: '🇬🇧 / 🇷🇺 Сменить язык',
        donations_text: 'Вы можете поддержать создателя проекта по этой ссылке для обмена. Спасибо! 🙏',
        creator_steam_link_text: '🎮 Посетите Steam создателя:',
        external_sites_menu_title: '🌐 Выберите внешний сайт:',
        skinport_soon_btn: 'Skinport (скоро!)',
        skinbaron_soon_btn: 'SkinBaron (скоро!)',
        csfloat_soon_btn: 'CSFloat (скоро!)',
        dmarket_soon_btn: 'DMarket (скоро!)',
        feature_soon_alert: 'Эта функция в разработке!',
        back_btn: '🔙 Назад',
        back_to_categories_btn: '🔙 Назад к категориям',
        main_menu_btn: '🔙 Главное меню',
        choose_weapon_category: '🔫 Пожалуйста, выберите категорию оружия:',
        choose_weapon: '🔫 Пожалуйста, выберите оружие:',
        no_skins_found: '🤔 Скины не найдены для',
        choose_skin_for: '🎨 Пожалуйста, выберите скин для',
        page: 'Стр.',
        searching_prices: '⏳ Ищу цены...',
        searching_prices_once: '⏳ Ищу цены (это медленно только в первый раз)...',
        skin_info_not_found: '❌ Информация о скине не найдена.',
        prices_in: '_Цены в USD ($) / EUR (€), получены с торговой площадки Steam._',
        normal_prices: '*--- Обычные ---*',
        stattrak_prices: '*--- StatTrak™ ---*',
        souvenir_prices: '*--- Сувенирные ---*',
        show_normal_btn: '⬅️ Показать обычные',
        show_stattrak_btn: '⭐ Показать StatTrak™',
        show_souvenir_btn: '🏆 Показать сувенирные',
        query_expired_log: "Перехвачена ошибка 'query is too old'. Это ожидаемо, если бот занят. Игнорируется."
    }
};

const bot = new Telegraf(process.env.BOT_TOKEN);

// Translation helper function
const t = (ctx, key) => {
    const lang = userLanguage[ctx.chat?.id] || 'en';
    return locales[lang][key] || key;
};

// --- Data Loading & Processing ---
const loadSkinsData = async () => {
    try {
        console.log("Fetching all skins data from API...");
        const response = await axios.get('https://bymykel.github.io/CSGO-API/api/en/skins.json');
        allSkinsData = response.data.filter(skin => skin.rarity.name !== 'Contraband');
        for (const skin of allSkinsData) {
            if (skin.weapon) {
                const weaponName = skin.weapon.name;
                if (!skinsByWeapon[weaponName]) skinsByWeapon[weaponName] = [];
                skinsByWeapon[weaponName].push(skin);
            }
        }
        console.log(`✅ Successfully loaded and processed ${allSkinsData.length} skins.`);
    } catch (error) {
        console.error("❌ Failed to load skins data:", error.message);
        process.exit(1);
    }
};

// --- Price Fetching ---
const getPrice = async (market_hash_name) => {
    const encodedName = encodeURIComponent(market_hash_name);
    const usdUrl = `https://steamcommunity.com/market/priceoverview/?appid=730&currency=1&market_hash_name=${encodedName}`;
    const eurUrl = `https://steamcommunity.com/market/priceoverview/?appid=730&currency=3&market_hash_name=${encodedName}`;
    const fetchCurrency = async (url) => {
        try {
            const res = await axios.get(url, { timeout: 5000 });
            if (res.data && res.data.success) return res.data.lowest_price || res.data.median_price || 'N/A';
            return 'N/A';
        } catch (error) { return 'N/A'; }
    };
    const [usdPrice, eurPrice] = await Promise.all([fetchCurrency(usdUrl), fetchCurrency(eurUrl)]);
    return { usd: usdPrice, eur: eurPrice };
};

// --- Menu Building ---
const buildKeyboard = (items, columns) => {
    const keyboard = [];
    for (let i = 0; i < items.length; i += columns) keyboard.push(items.slice(i, i + columns));
    return keyboard;
};

const buildMainMenu = (ctx) => {
    return {
        inline_keyboard: [
            [{ text: t(ctx, 'steam_prices_btn'), callback_data: 'steam_price_check_start' }],
            [{ text: t(ctx, 'external_sites_btn'), callback_data: 'external_sites' }],
            [{ text: t(ctx, 'donations_btn'), callback_data: 'donations' }],
            [{ text: t(ctx, 'creator_profile_btn'), callback_data: 'creator_link' }],
            [{ text: t(ctx, 'random_skin_btn'), callback_data: 'random_skin' }],
            [{ text: t(ctx, 'switch_lang_btn'), callback_data: 'switch_lang' }]
        ]
    };
};

// --- Bot Start ---
bot.start((ctx) => {
    if (!userLanguage[ctx.chat.id]) userLanguage[ctx.chat.id] = 'en';
    ctx.reply(t(ctx, 'welcome'), { reply_markup: buildMainMenu(ctx) });
});

// --- Main Callback Query Router ---
bot.on('callback_query', async (ctx) => {
    try {
        await ctx.answerCbQuery();
    } catch (error) {
        console.log(t(ctx, 'query_expired_log'));
        return;
    }
    
    const data = ctx.callbackQuery.data;

    if (data === 'switch_lang') {
        userLanguage[ctx.chat.id] = (userLanguage[ctx.chat.id] || 'en') === 'en' ? 'ru' : 'en';
        return ctx.editMessageText(t(ctx, 'welcome'), { reply_markup: buildMainMenu(ctx) });
    }
    
    // --- Main Menu Buttons ---
    switch (data) {
        case 'creator_link':
            return ctx.reply(`${t(ctx, 'creator_steam_link_text')} https://steamcommunity.com/id/Martins228/`);
        case 'donations':
            return ctx.reply(`${t(ctx, 'donations_text')}\nhttps://steamcommunity.com/tradeoffer/new/?partner=1001131064&token=INFk54ur`);
        case 'external_sites':
            return ctx.editMessageText(t(ctx, 'external_sites_menu_title'), {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: t(ctx, 'skinport_soon_btn'), callback_data: 'site_soon' }, { text: t(ctx, 'skinbaron_soon_btn'), callback_data: 'site_soon' }],
                        [{ text: t(ctx, 'csfloat_soon_btn'), callback_data: 'site_soon' }, { text: t(ctx, 'dmarket_soon_btn'), callback_data: 'site_soon' }],
                        [{ text: t(ctx, 'back_btn'), callback_data: 'back_start'}]
                    ]
                }
            });
        case 'site_soon':
            return ctx.answerCbQuery(t(ctx, 'feature_soon_alert'), { show_alert: true });
        case 'random_skin':
            await ctx.editMessageText(t(ctx, 'searching_prices'));
            const randomSkin = allSkinsData[Math.floor(Math.random() * allSkinsData.length)];
            return displayPriceResult(ctx, randomSkin.id, 'Normal', true);
        
        // --- Navigation and Category Selection ---
        case 'steam_price_check_start':
            const lang = userLanguage[ctx.chat.id] || 'en';
            const categoryButtons = Object.keys(weaponCategories[lang]).map(key => ({
                text: weaponCategories[lang][key], callback_data: `category_${key}`
            }));
            return ctx.editMessageText(t(ctx, 'choose_weapon_category'), { reply_markup: { inline_keyboard: buildKeyboard(categoryButtons, 2) } });
        
        case 'back_start':
            if (ctx.callbackQuery.message.photo) {
                await ctx.deleteMessage();
                return ctx.reply(t(ctx, 'welcome'), { reply_markup: buildMainMenu(ctx) });
            } else {
                return ctx.editMessageText(t(ctx, 'welcome'), { reply_markup: buildMainMenu(ctx) });
            }
    }

    // --- Dynamic Payload Handlers ---
    const [action, payload] = data.split(/_(.*)/s);

    if (action === 'category') {
        const weaponList = weapons[payload] || [];
        const buttons = weaponList.map(weapon => ({ text: weapon, callback_data: `weapon_${weapon}` }));
        const keyboard = buildKeyboard(buttons, 2);
        keyboard.push([{ text: t(ctx, 'back_to_categories_btn'), callback_data: 'steam_price_check_start' }]);
        return ctx.editMessageText(t(ctx, 'choose_weapon'), { reply_markup: { inline_keyboard: keyboard } });
    }

    if (action === 'weapon' || (action === 'nav' && payload.includes(':'))) {
        const [weaponName, pageStr] = (action === 'weapon' ? [payload, '1'] : payload.split(':'));
        const page = parseInt(pageStr, 10);
        const skinsForWeapon = skinsByWeapon[weaponName] || [];
        if (skinsForWeapon.length === 0) return ctx.editMessageText(`${t(ctx, 'no_skins_found')} ${weaponName}.`);
        const totalPages = Math.ceil(skinsForWeapon.length / SKINS_PER_PAGE);
        const startIndex = (page - 1) * SKINS_PER_PAGE;
        const pageSkins = skinsForWeapon.slice(startIndex, startIndex + SKINS_PER_PAGE);
        const skinButtons = pageSkins.map(skin => ({ text: skin.name.replace(`${weaponName} | `, ''), callback_data: `skin_${skin.id}` }));
        const navButtons = [];
        if (page > 1) navButtons.push({ text: '⬅️ Previous', callback_data: `nav_${weaponName}:${page - 1}` });
        if (page < totalPages) navButtons.push({ text: 'Next ➡️', callback_data: `nav_${weaponName}:${page + 1}` });
        const keyboard = buildKeyboard(skinButtons, 2);
        if (navButtons.length > 0) keyboard.push(navButtons);
        // Find the category of the current weapon to set the correct back button
        const categoryKey = Object.keys(weapons).find(key => weapons[key].includes(weaponName));
        keyboard.push([{ text: t(ctx, 'back_btn'), callback_data: `category_${categoryKey}` }]);
        return ctx.editMessageText(
            `${t(ctx, 'choose_skin_for')} *${weaponName}* (${t(ctx, 'page')} ${page}/${totalPages}):`, {
                parse_mode: 'Markdown', reply_markup: { inline_keyboard: keyboard }
            }
        );
    }
    
    // Price display routing
    if (action === 'skin') return displayPriceResult(ctx, payload, 'Normal');
    if (action === 'stattrak') return displayPriceResult(ctx, payload, 'StatTrak™');
    if (action === 'souvenir') return displayPriceResult(ctx, payload, 'Souvenir');
});

/**
 * Primary function for displaying all price results.
 */
const displayPriceResult = async (ctx, skinId, variant, isRandom = false) => {
    const skinInfo = allSkinsData.find(s => s.id === skinId);
    if (!skinInfo) return ctx.reply(t(ctx, 'skin_info_not_found'));

    const cacheKey = `${variant}_${skinId}`;
    const cached = priceCache.get(cacheKey);

    // --- BUG FIX for Random Skin ---
    // The `isRandom` flag takes top priority. If true, we always fetch fresh data and send a new photo.
    // The original bug was trying to edit a message that didn't exist yet.
    if (!isRandom && cached && (Date.now() - cached.timestamp < CACHE_DURATION_MS)) {
        if (ctx.callbackQuery?.message?.photo) {
            return ctx.editMessageCaption(cached.caption, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: cached.keyboard } });
        }
    }

    if (!ctx.callbackQuery?.message?.photo) {
        await ctx.editMessageText(t(ctx, 'searching_prices_once'));
    }

    const wears = ['Factory New', 'Minimal Wear', 'Field-Tested', 'Well-Worn', 'Battle-Scarred'];
    const prices = [];
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    const formatPrice = (p) => `*${p.usd !== 'N/A' ? p.usd : '---'} / ${p.eur !== 'N/A' ? p.eur : '---'}*`;

    for (const wear of wears) {
        const fullName = variant === 'Normal' ? `${skinInfo.name} (${wear})` : `${variant} ${skinInfo.name} (${wear})`;
        prices.push(await getPrice(fullName));
        await delay(300);
    }

    let priceTitleKey = 'normal_prices';
    if (variant === 'StatTrak™') priceTitleKey = 'stattrak_prices';
    if (variant === 'Souvenir') priceTitleKey = 'souvenir_prices';
    
    let caption = `*${skinInfo.name}*\n\n${t(ctx, priceTitleKey)}\n`;
    wears.forEach((wear, i) => { caption += `${wear}: ${formatPrice(prices[i])}\n`; });
    caption += `\n${t(ctx, 'prices_in')}`;
    
    const keyboardRows = [];
    const variantButtons = [];
    if (variant !== 'Normal') variantButtons.push({ text: t(ctx, 'show_normal_btn'), callback_data: `skin_${skinId}` });
    if (skinInfo.stattrak && variant !== 'StatTrak™') variantButtons.push({ text: t(ctx, 'show_stattrak_btn'), callback_data: `stattrak_${skinId}` });
    if (skinInfo.souvenir && variant !== 'Souvenir') variantButtons.push({ text: t(ctx, 'show_souvenir_btn'), callback_data: `souvenir_${skinId}` });
    
    if (variantButtons.length > 0) keyboardRows.push(variantButtons);
    keyboardRows.push([{ text: t(ctx, 'main_menu_btn'), callback_data: 'back_start' }]);
    const finalKeyboard = { inline_keyboard: keyboardRows };

    priceCache.set(cacheKey, { caption, keyboard: finalKeyboard.inline_keyboard, timestamp: Date.now() });

    if (isRandom || !ctx.callbackQuery?.message?.photo) {
        await ctx.deleteMessage();
        return ctx.replyWithPhoto(skinInfo.image, { caption, parse_mode: 'Markdown', reply_markup: finalKeyboard });
    } else {
        return ctx.editMessageCaption(caption, { parse_mode: 'Markdown', reply_markup: finalKeyboard });
    }
};

// --- Bot Launch ---
const main = async () => {
    console.log('--- Dante CS2 Bot | Build: 0.05A ---');
    await loadSkinsData();
    console.log("Loaded token:", process.env.BOT_TOKEN ? "OK" : "MISSING! Check your .env file.");
    bot.launch();
    console.log('🚀 Bot is running!');
};

main();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));