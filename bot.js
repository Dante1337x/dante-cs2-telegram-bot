require('dotenv').config();
const { Telegraf } = require('telegraf');
const axios = require('axios');

// --- State and Cache ---
let allSkinsData = [];
const skinsByWeapon = {};
const SKINS_PER_PAGE = 8;
// --- MODIFIED: Cache is less critical now per-skin, but still useful for random/repeated single lookups.
const priceCache = new Map();
const CACHE_DURATION_MS = 10 * 60 * 1000; // Cache results for 10 minutes.

// Language state management
const userLanguage = {}; // Stores user language preference { chatId: 'en' | 'ru' }

// --- Weapon Categorization (Unchanged) ---
const weaponCategories = {
    en: { pistols: 'Pistols', smgs: 'SMGs', rifles: 'Rifles', heavy: 'Heavy', knives: 'Knives', gloves: 'Gloves' },
    ru: { pistols: 'Пистолеты', smgs: 'ПП', rifles: 'Винтовки', heavy: 'Тяжелое', knives: 'Ножи', gloves: 'Перчатки' }
};
const weapons = {
    pistols: ['Glock-18', 'P2000', 'USP-S', 'Dual Berettas', 'P250', 'Tec-9', 'Five-SeveN', 'CZ75-Auto', 'Desert Eagle', 'R8 Revolver'],
    smgs: ['MAC-10', 'MP9', 'MP7', 'MP5-SD', 'UMP-45', 'P90', 'PP-Bizon'],
    rifles: ['Galil AR', 'FAMAS', 'AK-47', 'M4A4', 'M4A1-S', 'SSG 08', 'SG 553', 'AUG', 'AWP', 'G3SG1', 'SCAR-20'],
    heavy: ['Nova', 'XM1014', 'Sawed-Off', 'MAG-7', 'M249', 'Negev'],
    knives: ['Bayonet', 'Bowie Knife', 'Butterfly Knife', 'Classic Knife', 'Falchion Knife', 'Flip Knife', 'Gut Knife', 'Huntsman Knife', 'Karambit', 'Kukri Knife', 'M9 Bayonet', 'Navaja Knife', 'Nomad Knife', 'Paracord Knife', 'Shadow Daggers', 'Skeleton Knife', 'Stiletto Knife', 'Survival Knife', 'Talon Knife', 'Ursus Knife'],
    gloves: ['Broken Fang Gloves', 'Driver Gloves', 'Hand Wraps', 'Hydra Gloves', 'Moto Gloves', 'Specialist Gloves', 'Sport Gloves']
};
// --- NEW: Wears list for menu generation ---
const WEAR_CONDITIONS = ['Factory New', 'Minimal Wear', 'Field-Tested', 'Well-Worn', 'Battle-Scarred'];


// --- Centralized Locales ---
const locales = {
    en: {
        welcome: '👋​​🔮​ Hi, I\'m Dante. What can I do for you?​💎​',
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
        // --- NEW & MODIFIED text for the new flow ---
        choose_variant_for: '⭐ Please choose a variant for',
        choose_wear_for: '🎨 Please choose a wear condition for',
        variant_normal: 'Normal',
        variant_stattrak: 'StatTrak™',
        variant_souvenir: 'Souvenir',
        page: 'Page',
        searching_prices: '⏳ Searching for the price...',
        skin_info_not_found: '❌ Skin info not found.',
        price_not_available: 'Price not available',
        price_for: 'Price for',
        prices_in: '_Prices in USD ($) / EUR (€), fetched from Steam Market._',
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
         // --- NEW & MODIFIED text for the new flow ---
        choose_variant_for: '⭐ Пожалуйста, выберите вариант для',
        choose_wear_for: '🎨 Пожалуйста, выберите состояние для',
        variant_normal: 'Обычный',
        variant_stattrak: 'StatTrak™',
        variant_souvenir: 'Сувенирный',
        page: 'Стр.',
        searching_prices: '⏳ Ищу цену...',
        skin_info_not_found: '❌ Информация о скине не найдена.',
        price_not_available: 'Цена недоступна',
        price_for: 'Цена для',
        prices_in: '_Цены в USD ($) / EUR (€), получены с торговой площадки Steam._',
        query_expired_log: "Перехвачена ошибка 'query is too old'. Это ожидаемо, если бот занят. Игнорируется."
    }
};

const bot = new Telegraf(process.env.BOT_TOKEN);

// Translation helper function
const t = (ctx, key) => {
    const lang = userLanguage[ctx.chat?.id] || 'en';
    return locales[lang][key] || key;
};

// --- Data Loading & Processing (Unchanged) ---
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

// --- Price Fetching (Unchanged) ---
const getPrice = async (market_hash_name) => {
    const cacheKey = market_hash_name;
    const cached = priceCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < CACHE_DURATION_MS)) {
        return cached.price;
    }

    const encodedName = encodeURIComponent(market_hash_name);
    const usdUrl = `https://steamcommunity.com/market/priceoverview/?appid=730&currency=1&market_hash_name=${encodedName}`;
    const eurUrl = `https://steamcommunity.com/market/priceoverview/?appid=730&currency=3&market_hash_name=${encodedName}`;
    
    const fetchCurrency = async (url) => {
        try {
            await new Promise(resolve => setTimeout(resolve, 300)); // Add small delay to be safe with API
            const res = await axios.get(url, { timeout: 7000 });
            if (res.data && res.data.success) return res.data.lowest_price || res.data.median_price || null;
            return null;
        } catch (error) { return null; }
    };

    const [usdPrice, eurPrice] = await Promise.all([fetchCurrency(usdUrl), fetchCurrency(eurUrl)]);
    const price = { usd: usdPrice, eur: eurPrice };
    
    // Only cache successful results
    if (usdPrice || eurPrice) {
        priceCache.set(cacheKey, { price, timestamp: Date.now() });
    }
    
    return price;
};


// --- Menu Building (Unchanged) ---
const buildKeyboard = (items, columns) => {
    const keyboard = [];
    for (let i = 0; i < items.length; i += columns) keyboard.push(items.slice(i, i + columns));
    return keyboard;
};

const buildMainMenu = (ctx) => ({
    inline_keyboard: [
        [{ text: t(ctx, 'steam_prices_btn'), callback_data: 'steam_price_check_start' }],
        [{ text: t(ctx, 'external_sites_btn'), callback_data: 'external_sites' }],
        [{ text: t(ctx, 'donations_btn'), callback_data: 'donations' }],
        [{ text: t(ctx, 'creator_profile_btn'), callback_data: 'creator_link' }],
        [{ text: t(ctx, 'random_skin_btn'), callback_data: 'random_skin' }],
        [{ text: t(ctx, 'switch_lang_btn'), callback_data: 'switch_lang' }]
    ]
});

// --- Bot Start (Unchanged) ---
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
    const [action, ...payloadParts] = data.split(':');
    const payload = payloadParts.join(':');

    // --- Language and Main Menu (Unchanged) ---
    if (action === 'switch_lang') {
        userLanguage[ctx.chat.id] = (userLanguage[ctx.chat.id] || 'en') === 'en' ? 'ru' : 'en';
        return ctx.editMessageText(t(ctx, 'welcome'), { reply_markup: buildMainMenu(ctx) });
    }
    if (action === 'creator_link') return ctx.reply(`${t(ctx, 'creator_steam_link_text')} https://steamcommunity.com/id/Martins228/`);
    if (action === 'donations') return ctx.reply(`${t(ctx, 'donations_text')}\nhttps://steamcommunity.com/tradeoffer/new/?partner=1001131064&token=INFk54ur`);
    if (action === 'external_sites') {
        return ctx.editMessageText(t(ctx, 'external_sites_menu_title'), {
            reply_markup: {
                inline_keyboard: [
                    [{ text: t(ctx, 'skinport_soon_btn'), callback_data: 'site_soon' }, { text: t(ctx, 'skinbaron_soon_btn'), callback_data: 'site_soon' }],
                    [{ text: t(ctx, 'csfloat_soon_btn'), callback_data: 'site_soon' }, { text: t(ctx, 'dmarket_soon_btn'), callback_data: 'site_soon' }],
                    [{ text: t(ctx, 'back_btn'), callback_data: 'back_start'}]
                ]
            }
        });
    }
    if (action === 'site_soon') return ctx.answerCbQuery(t(ctx, 'feature_soon_alert'), { show_alert: true });
    
    // --- MODIFIED: Random Skin now picks a random wear to be more API friendly ---
    if (action === 'random_skin') {
        await ctx.editMessageText(t(ctx, 'searching_prices'));
        const randomSkin = allSkinsData[Math.floor(Math.random() * allSkinsData.length)];
        const randomWear = WEAR_CONDITIONS[Math.floor(Math.random() * WEAR_CONDITIONS.length)];
        let variant = 'Normal';
        if (randomSkin.stattrak && Math.random() > 0.5) variant = 'StatTrak';
        if (randomSkin.souvenir && Math.random() > 0.5) variant = 'Souvenir'; // can overwrite StatTrak, that's fine for random.
        return displayFinalPrice(ctx, randomSkin.id, variant, randomWear);
    }

    if (action === 'back_start') {
        if (ctx.callbackQuery.message.photo) {
            await ctx.deleteMessage();
            return ctx.reply(t(ctx, 'welcome'), { reply_markup: buildMainMenu(ctx) });
        } else {
            return ctx.editMessageText(t(ctx, 'welcome'), { reply_markup: buildMainMenu(ctx) });
        }
    }
    
    // --- Price Check Flow ---
    if (action === 'steam_price_check_start') {
        const lang = userLanguage[ctx.chat.id] || 'en';
        const categoryButtons = Object.keys(weaponCategories[lang]).map(key => ({
            text: weaponCategories[lang][key], callback_data: `category:${key}`
        }));
        return ctx.editMessageText(t(ctx, 'choose_weapon_category'), { reply_markup: { inline_keyboard: buildKeyboard(categoryButtons, 2) } });
    }
    
    if (action === 'category') {
        const weaponList = weapons[payload] || [];
        const buttons = weaponList.map(weapon => ({ text: weapon, callback_data: `weapon:${weapon}` }));
        const keyboard = buildKeyboard(buttons, 2);
        keyboard.push([{ text: t(ctx, 'back_to_categories_btn'), callback_data: 'steam_price_check_start' }]);
        return ctx.editMessageText(t(ctx, 'choose_weapon'), { reply_markup: { inline_keyboard: keyboard } });
    }

    if (action === 'weapon' || action === 'nav') {
        const [weaponName, pageStr] = (action === 'weapon' ? [payload, '1'] : payload.split(':'));
        const page = parseInt(pageStr, 10);
        const skinsForWeapon = skinsByWeapon[weaponName] || [];
        if (skinsForWeapon.length === 0) return ctx.editMessageText(`${t(ctx, 'no_skins_found')} ${weaponName}.`);
        
        const totalPages = Math.ceil(skinsForWeapon.length / SKINS_PER_PAGE);
        const pageSkins = skinsForWeapon.slice((page - 1) * SKINS_PER_PAGE, page * SKINS_PER_PAGE);
        
        const skinButtons = pageSkins.map(skin => ({ text: skin.name.replace(`${weaponName} | `, ''), callback_data: `skin:${skin.id}:${weaponName}` }));
        const navButtons = [];
        if (page > 1) navButtons.push({ text: '⬅️ Previous', callback_data: `nav:${weaponName}:${page - 1}` });
        if (page < totalPages) navButtons.push({ text: 'Next ➡️', callback_data: `nav:${weaponName}:${page + 1}` });
        
        const keyboard = buildKeyboard(skinButtons, 2);
        if (navButtons.length > 0) keyboard.push(navButtons);
        
        const categoryKey = Object.keys(weapons).find(key => weapons[key].includes(weaponName));
        keyboard.push([{ text: t(ctx, 'back_btn'), callback_data: `category:${categoryKey}` }]);
        
        return ctx.editMessageText(
            `${t(ctx, 'choose_skin_for')} *${weaponName}* (${t(ctx, 'page')} ${page}/${totalPages}):`, {
                parse_mode: 'Markdown', reply_markup: { inline_keyboard: keyboard }
            }
        );
    }
    
    // --- NEW: Step 1 - After selecting a skin, show variant options ---
    if (action === 'skin') {
        const [skinId, weaponName] = payload.split(':');
        const skinInfo = allSkinsData.find(s => s.id === skinId);
        if (!skinInfo) return ctx.answerCbQuery(t(ctx, 'skin_info_not_found'));

        const buttons = [
            { text: t(ctx, 'variant_normal'), callback_data: `variant:Normal:${skinId}` }
        ];
        if (skinInfo.stattrak) {
            buttons.push({ text: t(ctx, 'variant_stattrak'), callback_data: `variant:StatTrak:${skinId}` });
        }
        if (skinInfo.souvenir) {
            buttons.push({ text: t(ctx, 'variant_souvenir'), callback_data: `variant:Souvenir:${skinId}` });
        }

        const keyboard = buildKeyboard(buttons, 2);
        keyboard.push([{ text: t(ctx, 'back_btn'), callback_data: `weapon:${weaponName}` }]);

        return ctx.editMessageText(`${t(ctx, 'choose_variant_for')} *${skinInfo.name}*`, {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: keyboard }
        });
    }

    // --- NEW: Step 2 - After selecting a variant, show wear options ---
    if (action === 'variant') {
        const [variant, skinId] = payload.split(':');
        const skinInfo = allSkinsData.find(s => s.id === skinId);
        if (!skinInfo) return ctx.answerCbQuery(t(ctx, 'skin_info_not_found'));

        const wearButtons = WEAR_CONDITIONS.map(wear => ({
            text: wear,
            callback_data: `wear:${wear}:${variant}:${skinId}`
        }));

        const keyboard = buildKeyboard(wearButtons, 2);
        keyboard.push([{ text: t(ctx, 'back_btn'), callback_data: `skin:${skinId}:${skinInfo.weapon.name}` }]);

        const variantText = variant === 'StatTrak' ? t(ctx, 'variant_stattrak') : (variant === 'Souvenir' ? t(ctx, 'variant_souvenir') : '');
        return ctx.editMessageText(`${t(ctx, 'choose_wear_for')} *${variantText} ${skinInfo.name}*`, {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: keyboard }
        });
    }

    // --- NEW: Step 3 - After selecting wear, get the price ---
    if (action === 'wear') {
        const [wear, variant, skinId] = payload.split(':');
        await ctx.editMessageText(t(ctx, 'searching_prices'));
        return displayFinalPrice(ctx, skinId, variant, wear);
    }
});

/**
 * --- MODIFIED: Renamed and simplified to display a single price result ---
 * Displays a photo and caption for one specific skin variant and wear.
 */
const displayFinalPrice = async (ctx, skinId, variant, wear) => {
    const skinInfo = allSkinsData.find(s => s.id === skinId);
    if (!skinInfo) {
        await ctx.deleteMessage(); // remove "searching..." message
        return ctx.reply(t(ctx, 'skin_info_not_found'));
    }

    // Construct the full market name
    let fullName = `${skinInfo.name} (${wear})`;
    let displayVariant = '';
    if (variant === 'StatTrak') {
        fullName = `StatTrak™ ${fullName}`;
        displayVariant = `*${t(ctx, 'variant_stattrak')}*`;
    } else if (variant === 'Souvenir') {
        fullName = `Souvenir ${fullName}`;
        displayVariant = `*${t(ctx, 'variant_souvenir')}*`;
    }

    const price = await getPrice(fullName);

    // Format the price string
    const priceText = (price.usd || price.eur)
        ? `*${price.usd || '---'} / ${price.eur || '---'}*`
        : `*${t(ctx, 'price_not_available')}*`;

    // Build the final caption
    const caption = `${displayVariant} *${skinInfo.name}*\n(${wear})\n\n${t(ctx, 'price_for')}: ${priceText}\n\n${t(ctx, 'prices_in')}`;
    
    // --- NEW: Simplified keyboard with only a Main Menu button ---
    const finalKeyboard = {
        inline_keyboard: [
            [{ text: t(ctx, 'main_menu_btn'), callback_data: 'back_start' }]
        ]
    };
    
    // Delete the "Searching..." message and reply with the final result photo
    await ctx.deleteMessage();
    await ctx.replyWithPhoto(skinInfo.image, {
        caption,
        parse_mode: 'Markdown',
        reply_markup: finalKeyboard
    });
};

// --- Bot Launch ---
const main = async () => {
    console.log('--- Dante CS2 Bot | Build: 0.06 (Refactored Logic) ---');
    await loadSkinsData();
    console.log("Loaded token:", process.env.BOT_TOKEN ? "OK" : "MISSING! Check your .env file.");
    bot.launch(() => {
        console.log('🚀 Bot is running!');
    });
};

main();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
