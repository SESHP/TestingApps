// Translation strings for all languages

export const translations = {
  en: {
    // App
    loading: 'Loading...',

    // Bottom Tabs
    profile: 'Profile',
    inventory: 'Inventory',
    guarantee: 'Guarantee',

    // Profile Page
    guest: 'Guest',
    deals: 'Deals',
    rating: 'Rating',
    switchCurrency: 'Switch currency',
    depositBalance: 'Deposit balance',
    referralProgram: 'Referral Program',
    invited: 'Invited',
    earnedTON: 'Earned TON',
    yourReferralCode: 'Your referral code:',
    inviteFriends: 'Invite friends and get 5% TON from each of their deals.',

    // Inventory Page
    gift: 'Gift',
    gifts_one: 'Gift',
    gifts_few: 'Gifts',
    gifts_many: 'Gifts',
    loadingGifts: 'Loading gifts...',
    yourInventoryEmpty: 'Your inventory is empty',
    sendGiftTo: 'Send a gift to @FNPK3 to see it here',
    collectible: 'Collectible',
    model: 'Model:',
    background: 'Background:',
    pattern: 'Pattern:',
    withdrawGift: 'Withdraw gift',
    withdrawing: 'Withdrawing...',
    withdrawn: 'Withdrawn',
    giftWithdrawnSuccess: 'Gift successfully withdrawn!',
    failedToWithdraw: 'Failed to withdraw gift',

    // Guarantee Page
    guaranteeService: 'Guarantee Service',
    safeGiftExchange: 'Safe gift exchange',
    createExchange: 'Create exchange',
    joinExchange: 'Join exchange',

    // Guarantee Features
    feature1Title: 'Create exchange',
    feature1Description: 'Get a unique invitation code',
    feature2Title: 'Invite participant',
    feature2Description: 'Send the code to another user',
    feature3Title: 'Add gifts',
    feature3Description: 'Select gifts from inventory to exchange',
    feature4Title: 'Confirm exchange',
    feature4Description: 'Both participants confirm the terms',

    // Guarantee Deal Flow
    waitingForParticipant: 'Waiting for participant',
    invitationCode: 'Invitation code',
    clickToCopy: 'Click to copy',
    sendCodeToUser: 'Send this code to another user. As soon as they join, you can start the exchange.',
    waitingForConnection: 'Waiting for connection to exchange...',
    exchangeCreated: 'Exchange created',
    waitingParticipant: 'Waiting for participant',
    addingGifts: 'Adding gifts',
    confirmingExchange: 'Confirming exchange',
    cancelExchange: 'Cancel exchange',

    // Deal Screen
    addGiftsFromInventory: 'Add gifts from inventory',
    waitingForGifts: 'Waiting for gifts...',
    myInventory: 'My Inventory',
    noGiftsAvailable: 'You have no available gifts',
    lockGifts: 'Lock gifts',
    bothMustAddGift: 'Both participants must add at least one gift',
    waitingForLock: 'Waiting for lock...',
    transitionToVerification: 'Transition to verification...',

    // Verification
    verifyComponents: 'Verify exchange components',
    hasError: 'Has error',
    allCorrect: 'All correct',
    waiting: 'Waiting...',

    // Modals
    addGift: 'Add gift?',
    cancel: 'Cancel',
    add: 'Add',

    // Join Screen
    join: 'Join',
    enterExchangeCode: 'Enter exchange code',
    back: 'Back',

    // Notifications
    participantJoined: 'Participant joined!',
    codeCopied: 'Invitation code copied!',
    code: 'Code',
    successfullyJoined: 'Successfully joined exchange!',
    dealNotFound: 'Deal not found',
    failedToJoin: 'Failed to join',
    failedToCreate: 'Failed to create deal',
    giftsLocked: 'Gifts locked',
    exchangeReturned: 'Exchange returned to editing',
    exchangeCompleted: 'Exchange completed!',
    exchangeCancelled: 'Exchange cancelled',
    errorOccurred: 'An error occurred',
    walletConnected: 'Wallet connected',

    // Deposit Modal
    depositBalanceTitle: 'Deposit balance',
    depositInfo: 'To deposit TON balance, you need to connect a wallet',
    connectWallet: 'Connect wallet',
    amountTON: 'Amount TON',
    amountStars: 'Amount Stars',
    deposit: 'Deposit',
    sending: 'Sending...',
    enterValidAmount: 'Enter a valid amount',
    connectWalletFirst: 'Connect wallet first',
    transactionError: 'Error sending transaction',
    paymentCancelled: 'Payment cancelled',
    paymentError: 'Payment error',
    paymentCreationError: 'Error creating payment',

    // Badge Modal
    yourCurrentStatus: 'Your current status',
    yourCommission: 'Your commission:',
    allStatuses: 'All statuses',

    // Badge Descriptions
    badgeDADDYDescription: 'Exclusive status for VIP users',
    badgeDADDYDetails: 'Only 0.1% commission. Unique referral code. Available for whales, investors, or channel owners with >500K subscribers.',
    badgeDADDYRequirements: 'Whale, investor, or >500K audience on Telegram',

    badgeINFLDescription: 'Status for influential users',
    badgeINFLDetails: '0.5% commission. Unique referral code. For channel owners with >70K subscribers.',
    badgeINFLRequirements: '>70K audience on Telegram',

    badgeRESIDENTDescription: 'Status for active residents',
    badgeRESIDENTDetails: '1% commission. For users with >70 deals per month and rating above 4.5.',
    badgeRESIDENTRequirements: '>70 deals/month, rating >4.5',

    badgeJOKERDescription: 'Status for experienced traders',
    badgeJOKERDetails: '2% commission. For users with >30 deals and rating above 4.0.',
    badgeJOKERRequirements: '>30 deals, rating >4.0',

    badgeGUESTDescription: 'Starter status for newcomers',
    badgeGUESTDetails: '4% commission. Base status for all new users with rating from 3.5.',
    badgeGUESTRequirements: 'Rating ≥3.5',

    badgeSCAMDescription: 'Warning about low rating',
    badgeSCAMDetails: '20% commission. This status is assigned to users with low rating. Improve your reputation to reduce commission.',
    badgeSCAMRequirements: '>5 deals, rating <1.0',

    // Loading Screen Phrases
    loadingPhrase1: 'Collecting gifts...',
    loadingPhrase2: 'Tweaking ref codes...',
    loadingPhrase3: 'Polishing interface...',
    loadingPhrase4: 'Starting database...',
    loadingPhrase5: 'Cleaning servers...',
    loadingPhrase6: 'Saving 10K stars...',
    loadingPhrase7: 'Waiting for TON to rise...',
    loadingPhrase8: 'Waiting for alt season...',
    loadingPhrase9: 'Syncing TON...',
    loadingPhrase10: 'Almost ready...',

    // Errors
    loadError: 'Failed to load',
    loadingError: 'Loading error:',
    failedToLoadInventory: 'Failed to load inventory',
    failedToLoadGifts: 'Failed to load gifts:',
    unknownModel: 'Unknown model',
  },

  ru: {
    // App
    loading: 'Загрузка...',

    // Bottom Tabs
    profile: 'Профиль',
    inventory: 'Инвентарь',
    guarantee: 'Гарант',

    // Profile Page
    guest: 'Гость',
    deals: 'Сделок',
    rating: 'Рейтинг',
    switchCurrency: 'Переключить валюту',
    depositBalance: 'Пополнить баланс',
    referralProgram: 'Реферальная программа',
    invited: 'Приглашено',
    earnedTON: 'Заработано TON',
    yourReferralCode: 'Ваш реферальный код:',
    inviteFriends: 'Пригласи друзей и получай 5% TON с каждой их сделки.',

    // Inventory Page
    gift: 'Подарок',
    gifts_one: 'Подарок',
    gifts_few: 'Подарка',
    gifts_many: 'Подарков',
    loadingGifts: 'Загрузка подарков...',
    yourInventoryEmpty: 'Ваш инвентарь пуст',
    sendGiftTo: 'Отправьте подарок на @FNPK3, чтобы он появился здесь',
    collectible: 'Коллекционный',
    model: 'Модель:',
    background: 'Фон:',
    pattern: 'Паттерн:',
    withdrawGift: 'Вывести подарок',
    withdrawing: 'Вывод...',
    withdrawn: 'Выведено',
    giftWithdrawnSuccess: 'Подарок успешно выведен!',
    failedToWithdraw: 'Не удалось вывести подарок',

    // Guarantee Page
    guaranteeService: 'Гарант-сервис',
    safeGiftExchange: 'Безопасный обмен подарками',
    createExchange: 'Создать обмен',
    joinExchange: 'Присоединиться к обмену',

    // Guarantee Features
    feature1Title: 'Создайте обмен',
    feature1Description: 'Получите уникальный код для приглашения',
    feature2Title: 'Пригласите участника',
    feature2Description: 'Отправьте код другому пользователю',
    feature3Title: 'Добавьте подарки',
    feature3Description: 'Выберите подарки для обмена из инвентаря',
    feature4Title: 'Подтвердите обмен',
    feature4Description: 'Оба участника подтверждают условия',

    // Guarantee Deal Flow
    waitingForParticipant: 'Ожидание участника',
    invitationCode: 'Код приглашения',
    clickToCopy: 'Нажмите, чтобы скопировать',
    sendCodeToUser: 'Отправьте этот код другому пользователю. Как только он присоединится, вы сможете начать обмен.',
    waitingForConnection: 'Ожидание подключения к обмену...',
    exchangeCreated: 'Обмен создан',
    waitingParticipant: 'Ожидание участника',
    addingGifts: 'Добавление подарков',
    confirmingExchange: 'Подтверждение обмена',
    cancelExchange: 'Отменить обмен',

    // Deal Screen
    addGiftsFromInventory: 'Добавьте подарки из инвентаря',
    waitingForGifts: 'Ожидание подарков...',
    myInventory: 'Мой инвентарь',
    noGiftsAvailable: 'У вас нет доступных подарков',
    lockGifts: 'Заблокировать подарки',
    bothMustAddGift: 'Оба участника должны добавить хотя бы один подарок',
    waitingForLock: 'Ожидание блокировки...',
    transitionToVerification: 'Переход к проверке...',

    // Verification
    verifyComponents: 'Проверьте компоненты обмена',
    hasError: 'Есть ошибка',
    allCorrect: 'Все верно',
    waiting: 'Ожидание...',

    // Modals
    addGift: 'Добавить подарок?',
    cancel: 'Отмена',
    add: 'Добавить',

    // Join Screen
    join: 'Присоединиться',
    enterExchangeCode: 'Введите код обмена',
    back: 'Назад',

    // Notifications
    participantJoined: 'Участник присоединился!',
    codeCopied: 'Код приглашения скопирован!',
    code: 'Код',
    successfullyJoined: 'Успешно присоединились к обмену!',
    dealNotFound: 'Сделка не найдена',
    failedToJoin: 'Не удалось присоединиться',
    failedToCreate: 'Не удалось создать сделку',
    giftsLocked: 'Подарки заблокированы',
    exchangeReturned: 'Обмен возвращен к редактированию',
    exchangeCompleted: 'Обмен завершен!',
    exchangeCancelled: 'Обмен отменен',
    errorOccurred: 'Произошла ошибка',
    walletConnected: 'Кошелек подключен',

    // Deposit Modal
    depositBalanceTitle: 'Пополнить баланс',
    depositInfo: 'Для пополнения баланса TON необходимо подключить кошелек',
    connectWallet: 'Подключить кошелек',
    amountTON: 'Сумма TON',
    amountStars: 'Сумма Stars',
    deposit: 'Пополнить',
    sending: 'Отправка...',
    enterValidAmount: 'Введите корректную сумму',
    connectWalletFirst: 'Сначала подключите кошелек',
    transactionError: 'Ошибка при отправке транзакции',
    paymentCancelled: 'Оплата отменена',
    paymentError: 'Ошибка оплаты',
    paymentCreationError: 'Ошибка при создании платежа',

    // Badge Modal
    yourCurrentStatus: 'Ваш текущий статус',
    yourCommission: 'Ваша комиссия:',
    allStatuses: 'Все статусы',

    // Badge Descriptions
    badgeDADDYDescription: 'Эксклюзивный статус для VIP-пользователей',
    badgeDADDYDetails: 'Комиссия всего 0.1%. Уникальный реферальный код. Доступен для китов, инвесторов или владельцев каналов с аудиторией >500K подписчиков.',
    badgeDADDYRequirements: 'Кит, инвестор или аудитория >500K в Telegram',

    badgeINFLDescription: 'Статус для влиятельных пользователей',
    badgeINFLDetails: 'Комиссия 0.5%. Уникальный реферальный код. Для владельцев каналов с аудиторией более 70K подписчиков.',
    badgeINFLRequirements: 'Аудитория >70K в Telegram',

    badgeRESIDENTDescription: 'Статус для активных резидентов',
    badgeRESIDENTDetails: 'Комиссия 1%. Для пользователей с более чем 70 сделками за месяц и рейтингом выше 4.5.',
    badgeRESIDENTRequirements: '>70 сделок/месяц, рейтинг >4.5',

    badgeJOKERDescription: 'Статус для опытных трейдеров',
    badgeJOKERDetails: 'Комиссия 2%. Для пользователей с более чем 30 сделками и рейтингом выше 4.0.',
    badgeJOKERRequirements: '>30 сделок, рейтинг >4.0',

    badgeGUESTDescription: 'Стартовый статус для новичков',
    badgeGUESTDetails: 'Комиссия 4%. Базовый статус для всех новых пользователей с рейтингом от 3.5.',
    badgeGUESTRequirements: 'Рейтинг ≥3.5',

    badgeSCAMDescription: 'Предупреждение о низком рейтинге',
    badgeSCAMDetails: 'Комиссия 20%. Этот статус присваивается пользователям с низким рейтингом. Улучшите свою репутацию для снижения комиссии.',
    badgeSCAMRequirements: '>5 сделок, рейтинг <1.0',

    // Loading Screen Phrases
    loadingPhrase1: 'Собираем подарки...',
    loadingPhrase2: 'Подкручиваем реф коды...',
    loadingPhrase3: 'Полируем интерфейс...',
    loadingPhrase4: 'Поднимаем базу...',
    loadingPhrase5: 'Убираем пыль с серверов...',
    loadingPhrase6: 'Копим 10К старс...',
    loadingPhrase7: 'Просим TON встать с колен...',
    loadingPhrase8: 'Ждем альтсезон...',
    loadingPhrase9: 'Синхронизируем TON...',
    loadingPhrase10: 'Почти готово...',

    // Errors
    loadError: 'Не удалось загрузить',
    loadingError: 'Ошибка загрузки:',
    failedToLoadInventory: 'Не удалось загрузить инвентарь',
    failedToLoadGifts: 'Не удалось загрузить подарки:',
    unknownModel: 'Неизвестная модель',
  }
};
