export type UiLanguage = 'en' | 'ja' | 'fr' | 'id';

export interface LanguageOption {
  id: UiLanguage;
  name: string;
  nativeName: string;
  flag: string;
}

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { id: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸' },
  { id: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
  { id: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
  { id: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia', flag: '🇮🇩' },
];

export function getDefaultLanguagePrompt(lang: UiLanguage): string {
  switch (lang) {
    case 'ja':
      return 'Always respond naturally in Japanese (日本語), keeping all roleplay narration, dialogue, and character personality intact.';
    case 'fr':
      return 'Always respond naturally in French (Français), keeping all roleplay narration, dialogue, and character personality intact.';
    case 'id':
      return 'Always respond naturally in Indonesian (Bahasa Indonesia), keeping all roleplay narration, dialogue, and character personality intact.';
    case 'en':
    default:
      return 'Always respond naturally in English, keeping all roleplay narration, dialogue, and character personality intact.';
  }
}

export type TranslationKey =
  | 'nav.chats'
  | 'nav.discover'
  | 'nav.studio'
  | 'nav.settings'
  | 'chats.subtitle'
  | 'chats.explore'
  | 'chats.myChats'
  | 'chats.active'
  | 'chats.empty'
  | 'chats.noActiveTitle'
  | 'chats.noActiveSub'
  | 'chats.exploreCatalog'
  | 'chats.createCard'
  | 'chats.startNewChat'
  | 'chats.details'
  | 'chats.latest'
  | 'chats.oldest'
  | 'chats.mostMsgs'
  | 'chats.select'
  | 'chats.done'
  | 'discover.catalogGrid'
  | 'discover.forYou'
  | 'discover.matchMode'
  | 'discover.exploreAll'
  | 'discover.myLibrary'
  | 'discover.searchPlaceholder'
  | 'discover.characters'
  | 'discover.creators'
  | 'discover.trending'
  | 'discover.popular'
  | 'discover.latest'
  | 'studio.title'
  | 'studio.subtitle'
  | 'studio.cards'
  | 'studio.characters'
  | 'studio.personas'
  | 'studio.lorebooks'
  | 'studio.codex'
  | 'studio.myCards'
  | 'studio.myCardsSub'
  | 'studio.noCards'
  | 'studio.noCardsSub'
  | 'studio.createCard'
  | 'studio.importCard'
  | 'studio.codexTitle'
  | 'studio.codexSub'
  | 'studio.addLorebook'
  | 'studio.noLorebooks'
  | 'studio.createFirstLorebook'
  | 'studio.create'
  | 'studio.import'
  | 'settings.title'
  | 'settings.subtitle'
  | 'settings.healthTitle'
  | 'settings.controlPanel'
  | 'settings.aiEngine'
  | 'settings.aiEngineSub'
  | 'settings.theming'
  | 'settings.themingSub'
  | 'settings.dataVault'
  | 'settings.dataVaultSub'
  | 'settings.personas'
  | 'settings.personasSub'
  | 'settings.tokens'
  | 'settings.tokensSub'
  | 'settings.about'
  | 'settings.languageTitle'
  | 'settings.languageSub'
  | 'settings.autoPromptLabel'
  | 'settings.autoPromptHint'
  | 'settings.customPromptLabel'
  | 'settings.resetPrompt'
  | 'settings.saveLanguage'
  | 'settings.aiModalTitle'
  | 'settings.textLlm'
  | 'settings.sceneArt'
  | 'settings.voiceTts'
  | 'settings.selectProvider'
  | 'settings.baseUrl'
  | 'settings.apiKey'
  | 'settings.modelId'
  | 'settings.fetchModels'
  | 'settings.testConn'
  | 'settings.saveApi'
  | 'settings.applyTheme'
  | 'settings.selectThemeSub'
  | 'settings.maxOutputTokens'
  | 'settings.unlimited'
  | 'studio.charModalNew'
  | 'studio.charAvatar'
  | 'studio.uploadImage'
  | 'studio.charName'
  | 'studio.tagline'
  | 'studio.scenario'
  | 'studio.personality'
  | 'studio.firstMsg'
  | 'studio.tagsLabel'
  | 'studio.saveChar'
  | 'studio.importModalTitle'
  | 'studio.uploadFileBtn'
  | 'studio.orPaste'
  | 'studio.parseLoad'
  | 'discover.allTags'
  | 'chat.typeMessage'
  | 'chat.writing'
  | 'chat.settings'
  | 'chat.memory'
  | 'chat.customize'
  | 'chat.applyClose'
  | 'chat.controlTitle'
  | 'chat.generationControls'
  | 'chat.instructions'
  | 'chat.customPrompt'
  | 'chat.prefill'
  | 'chat.forbiddenWords'
  | 'chat.options'
  | 'chat.autoscroll'
  | 'chat.textStreaming'
  | 'chat.readingLayout'
  | 'chat.chatBubbles'
  | 'chat.novelView'
  | 'chat.bgImage'
  | 'chat.copy'
  | 'chat.branch'
  | 'chat.voice'
  | 'chat.regenerate'
  | 'chat.continue'
  | 'chat.edit'
  | 'chat.delete';

export const TRANSLATIONS: Record<UiLanguage, Record<TranslationKey, string>> = {
  en: {
    'nav.chats': 'Chats',
    'nav.discover': 'Discover',
    'nav.studio': 'Studio',
    'nav.settings': 'Settings',
    'chats.subtitle': 'AI Companion & Roleplay',
    'chats.explore': 'Explore',
    'chats.myChats': 'My Chats',
    'chats.active': 'active',
    'chats.empty': 'Empty',
    'chats.noActiveTitle': 'No Active Chats Yet',
    'chats.noActiveSub': 'Discover anime companions from the community catalog or build your own custom character in the Studio.',
    'chats.exploreCatalog': 'Explore Catalog',
    'chats.createCard': 'Create Card',
    'chats.startNewChat': 'Start new chat',
    'chats.details': 'Details',
    'chats.latest': 'Latest',
    'chats.oldest': 'Oldest',
    'chats.mostMsgs': 'Most msgs',
    'chats.select': 'Select',
    'chats.done': 'Done',
    'discover.catalogGrid': 'Catalog Grid',
    'discover.forYou': 'For You',
    'discover.matchMode': 'Match Mode',
    'discover.exploreAll': 'Explore All',
    'discover.myLibrary': 'My Library',
    'discover.searchPlaceholder': 'Search anime companions, tags, tropes (@creator)...',
    'discover.characters': 'Characters',
    'discover.creators': 'Creators',
    'discover.trending': 'Trending',
    'discover.popular': 'Popular',
    'discover.latest': 'Latest',
    'studio.title': 'Studio',
    'studio.subtitle': 'User Cards & Personas',
    'studio.cards': 'Cards',
    'studio.characters': 'Characters',
    'studio.personas': 'Personas',
    'studio.lorebooks': 'Lorebooks',
    'studio.codex': 'Codex',
    'studio.myCards': 'My Character Cards',
    'studio.myCardsSub': 'Custom characters created by you',
    'studio.noCards': 'No Custom Cards Yet',
    'studio.noCardsSub': 'Create your own anime roleplay companion with custom world lore, personality traits, and first messages.',
    'studio.createCard': 'Create Card',
    'studio.importCard': 'Import Card',
    'studio.codexTitle': 'Codex Lorebooks',
    'studio.codexSub': 'World lore & keyword-triggered memories',
    'studio.addLorebook': 'Add Lorebook',
    'studio.noLorebooks': 'No Lorebooks Created',
    'studio.createFirstLorebook': 'Create First Lorebook',
    'studio.create': 'Create',
    'studio.import': 'Import',
    'settings.title': 'Settings',
    'settings.subtitle': 'Manage AI Engine, Voices, Personas & Vault',
    'settings.healthTitle': 'Service Health & Latency Monitor',
    'settings.controlPanel': 'SETTINGS & CONTROL PANEL',
    'settings.aiEngine': 'AI Engine Suite',
    'settings.aiEngineSub': 'LLM Brain, Scene Art & Voice',
    'settings.theming': 'Theming',
    'settings.themingSub': 'Palette & UI Accents',
    'settings.dataVault': 'Data Vault',
    'settings.dataVaultSub': 'Zero-key backup & import',
    'settings.personas': 'User Personas',
    'settings.personasSub': 'Manage profiles & switch',
    'settings.tokens': 'Token & Sampling',
    'settings.tokensSub': 'Context limit & parameters',
    'settings.about': 'About Neko',
    'settings.languageTitle': 'App Language & AI Prompt',
    'settings.languageSub': 'Switch UI language and optionally instruct AI replies',
    'settings.autoPromptLabel': 'Auto-add language instruction to AI messages',
    'settings.autoPromptHint': 'Automatically appends the editable prompt below so the AI replies in your selected UI language.',
    'settings.customPromptLabel': 'Language Custom Prompt (Editable)',
    'settings.resetPrompt': 'Reset to default',
    'settings.saveLanguage': 'Save Language Settings',
    'settings.aiModalTitle': 'AI Engine & Media Setup',
    'settings.textLlm': 'Text LLM',
    'settings.sceneArt': 'Scene Art',
    'settings.voiceTts': 'Voice TTS',
    'settings.selectProvider': 'Select Provider Profile',
    'settings.baseUrl': 'Base URL (Endpoint)',
    'settings.apiKey': 'API Secret Key',
    'settings.modelId': 'Model Identifier',
    'settings.fetchModels': 'Fetch Models',
    'settings.testConn': 'Auto-Test Connection',
    'settings.saveApi': 'Save API Configuration',
    'settings.applyTheme': 'Apply Theme',
    'settings.selectThemeSub': 'Select Theme Preset (Applies Instantly)',
    'settings.maxOutputTokens': 'Max Generation Output Tokens',
    'settings.unlimited': 'Unlimited',
    'studio.charModalNew': 'Create New Character',
    'studio.charAvatar': 'Character Avatar',
    'studio.uploadImage': 'Upload Image',
    'studio.charName': 'Character Name *',
    'studio.tagline': 'Tagline / Title',
    'studio.scenario': 'Scenario & Initial Context',
    'studio.personality': 'Personality & Behavioral Traits',
    'studio.firstMsg': 'First Greeting Message',
    'studio.tagsLabel': 'Tags (comma-separated)',
    'studio.saveChar': 'Save Character',
    'studio.importModalTitle': 'Import Character Card',
    'studio.uploadFileBtn': 'Upload .JSON or .PNG Card File',
    'studio.orPaste': 'Or Paste Card JSON / W++ Text',
    'studio.parseLoad': 'Parse & Load into Studio',
    'discover.allTags': 'All Tags',
    'chat.typeMessage': 'Type a message...',
    'chat.writing': 'Writing...',
    'chat.settings': 'Settings',
    'chat.memory': 'Memory',
    'chat.customize': 'Customize',
    'chat.applyClose': 'Apply & Close',
    'chat.controlTitle': 'Chat Control & Context',
    'chat.generationControls': 'Generation controls',
    'chat.instructions': 'Instructions',
    'chat.customPrompt': 'Custom prompt',
    'chat.prefill': 'Prefill',
    'chat.forbiddenWords': 'Forbidden words',
    'chat.options': 'Options',
    'chat.autoscroll': 'Enable autoscroll',
    'chat.textStreaming': 'Text streaming',
    'chat.readingLayout': 'Reading layout',
    'chat.chatBubbles': 'Chat Bubbles',
    'chat.novelView': 'Novel View',
    'chat.bgImage': 'Background image',
    'chat.copy': 'Copy',
    'chat.branch': 'Branch',
    'chat.voice': 'Voice',
    'chat.regenerate': 'Regenerate',
    'chat.continue': 'Continue',
    'chat.edit': 'Edit',
    'chat.delete': 'Delete',
  },
  ja: {
    'nav.chats': 'チャット',
    'nav.discover': '探索',
    'nav.studio': 'スタジオ',
    'nav.settings': '設定',
    'chats.subtitle': 'AIコンパニオン＆ロールプレイ',
    'chats.explore': '探索',
    'chats.myChats': 'マイチャット',
    'chats.active': '件',
    'chats.empty': '空',
    'chats.noActiveTitle': 'チャットがまだありません',
    'chats.noActiveSub': 'コミュニティカタログからキャラクターを探すか、スタジオでオリジナルキャラクターを作成しましょう。',
    'chats.exploreCatalog': 'カタログを見る',
    'chats.createCard': 'カード作成',
    'chats.startNewChat': '新しいチャット',
    'chats.details': '詳細',
    'chats.latest': '最新',
    'chats.oldest': '古い順',
    'chats.mostMsgs': 'メッセージ数',
    'chats.select': '選択',
    'chats.done': '完了',
    'discover.catalogGrid': 'カタログ',
    'discover.forYou': 'おすすめ',
    'discover.matchMode': 'マッチ',
    'discover.exploreAll': 'すべて探索',
    'discover.myLibrary': 'ライブラリ',
    'discover.searchPlaceholder': 'キャラクター・タグ・作者 (@creator) を検索...',
    'discover.characters': 'キャラ',
    'discover.creators': '作者',
    'discover.trending': 'トレンド',
    'discover.popular': '人気',
    'discover.latest': '新着',
    'studio.title': 'スタジオ',
    'studio.subtitle': 'マイキャラ＆ペルソナ管理',
    'studio.cards': 'カード',
    'studio.characters': 'キャラ',
    'studio.personas': 'ペルソナ',
    'studio.lorebooks': 'ロアブック',
    'studio.codex': 'ロアブック',
    'studio.myCards': 'マイキャラクターカード',
    'studio.myCardsSub': '作成したカスタムキャラクター',
    'studio.noCards': 'カスタムカードがまだありません',
    'studio.noCardsSub': 'オリジナルの世界観・性格・初回メッセージを設定してAIコンパニオンを作成しましょう。',
    'studio.createCard': 'カード作成',
    'studio.importCard': 'カード読込',
    'studio.codexTitle': 'ロアブック (Codex)',
    'studio.codexSub': 'キーワード連動の世界設定＆記憶',
    'studio.addLorebook': 'ロアブック追加',
    'studio.noLorebooks': 'ロアブックがありません',
    'studio.createFirstLorebook': '最初のロアブックを作成',
    'studio.create': '作成',
    'studio.import': '読込',
    'settings.title': '設定',
    'settings.subtitle': 'AIエンジン・音声・ペルソナ・バックアップ管理',
    'settings.healthTitle': 'サービス稼働＆レイテンシ監視',
    'settings.controlPanel': '設定＆コントロールパネル',
    'settings.aiEngine': 'AIエンジン設定',
    'settings.aiEngineSub': 'LLM・画像生成・音声',
    'settings.theming': 'テーマ設定',
    'settings.themingSub': '配色＆UIアクセント',
    'settings.dataVault': 'データ保管庫',
    'settings.dataVaultSub': 'バックアップ＆復元',
    'settings.personas': 'ユーザーペルソナ',
    'settings.personasSub': 'プロフィール管理・切替',
    'settings.tokens': 'トークン＆サンプリング',
    'settings.tokensSub': 'コンテキスト長＆生成設定',
    'settings.about': 'NekoChatについて',
    'settings.languageTitle': 'アプリ言語＆AIプロンプト',
    'settings.languageSub': 'UI言語の切り替えとAI応答言語の自動指定',
    'settings.autoPromptLabel': 'AIメッセージに言語指示を自動追加',
    'settings.autoPromptHint': '有効にすると下のカスタムプロンプトが自動追加され、選択した言語でAIが返信します。',
    'settings.customPromptLabel': '言語カスタムプロンプト（編集可能）',
    'settings.resetPrompt': 'デフォルトに戻す',
    'settings.saveLanguage': '言語設定を保存',
    'settings.aiModalTitle': 'AIエンジン＆メディア設定',
    'settings.textLlm': 'テキストLLM',
    'settings.sceneArt': 'シーン画像',
    'settings.voiceTts': '音声TTS',
    'settings.selectProvider': 'プロバイダーを選択',
    'settings.baseUrl': 'ベースURL (Endpoint)',
    'settings.apiKey': 'APIシークレットキー',
    'settings.modelId': 'モデルID',
    'settings.fetchModels': 'モデル一覧を取得',
    'settings.testConn': '接続テスト',
    'settings.saveApi': 'API設定を保存',
    'settings.applyTheme': 'テーマを適用',
    'settings.selectThemeSub': 'テーマを選択（即時反映）',
    'settings.maxOutputTokens': '最大出力トークン数',
    'settings.unlimited': '無制限',
    'studio.charModalNew': '新しいキャラクターを作成',
    'studio.charAvatar': 'キャラクター画像',
    'studio.uploadImage': '画像をアップロード',
    'studio.charName': 'キャラクター名 *',
    'studio.tagline': 'キャッチコピー / 肩書',
    'studio.scenario': 'シナリオ＆初期設定',
    'studio.personality': '性格＆行動特性',
    'studio.firstMsg': '最初の挨拶メッセージ',
    'studio.tagsLabel': 'タグ（カンマ区切り）',
    'studio.saveChar': 'キャラクターを保存',
    'studio.importModalTitle': 'キャラクターカードを読み込む',
    'studio.uploadFileBtn': '.JSON または .PNG カードを選択',
    'studio.orPaste': 'または JSON / W++ テキストを貼り付け',
    'studio.parseLoad': '解析してスタジオに読み込む',
    'discover.allTags': 'すべて',
    'chat.typeMessage': 'メッセージを入力...',
    'chat.writing': '入力中...',
    'chat.settings': '設定',
    'chat.memory': 'メモリ',
    'chat.customize': 'カスタマイズ',
    'chat.applyClose': '適用して閉じる',
    'chat.controlTitle': 'チャット設定＆コンテキスト',
    'chat.generationControls': '生成パラメータ',
    'chat.instructions': '指示プロンプト',
    'chat.customPrompt': 'カスタムプロンプト',
    'chat.prefill': 'プリフィル (Prefill)',
    'chat.forbiddenWords': '禁止ワード',
    'chat.options': 'オプション',
    'chat.autoscroll': '自動スクロール',
    'chat.textStreaming': 'テキストストリーミング',
    'chat.readingLayout': '表示レイアウト',
    'chat.chatBubbles': '吹き出し表示',
    'chat.novelView': 'ノベル表示',
    'chat.bgImage': '背景画像',
    'chat.copy': 'コピー',
    'chat.branch': '分岐',
    'chat.voice': '音声',
    'chat.regenerate': '再生成',
    'chat.continue': '続ける',
    'chat.edit': '編集',
    'chat.delete': '削除',
  },
  fr: {
    'nav.chats': 'Chats',
    'nav.discover': 'Découvrir',
    'nav.studio': 'Studio',
    'nav.settings': 'Paramètres',
    'chats.subtitle': 'Compagnon IA & Roleplay',
    'chats.explore': 'Explorer',
    'chats.myChats': 'Mes Chats',
    'chats.active': 'actifs',
    'chats.empty': 'Vide',
    'chats.noActiveTitle': 'Aucun chat actif',
    'chats.noActiveSub': 'Découvrez des personnages dans le catalogue ou créez le vôtre dans le Studio.',
    'chats.exploreCatalog': 'Explorer le catalogue',
    'chats.createCard': 'Créer une fiche',
    'chats.startNewChat': 'Nouveau chat',
    'chats.details': 'Détails',
    'chats.latest': 'Récents',
    'chats.oldest': 'Anciens',
    'chats.mostMsgs': 'Plus de msgs',
    'chats.select': 'Sélectionner',
    'chats.done': 'Terminé',
    'discover.catalogGrid': 'Catalogue',
    'discover.forYou': 'Pour vous',
    'discover.matchMode': 'Match',
    'discover.exploreAll': 'Tout explorer',
    'discover.myLibrary': 'Ma bibliothèque',
    'discover.searchPlaceholder': 'Rechercher personnages, tags, créateurs (@creator)...',
    'discover.characters': 'Personnages',
    'discover.creators': 'Créateurs',
    'discover.trending': 'Tendances',
    'discover.popular': 'Populaires',
    'discover.latest': 'Récents',
    'studio.title': 'Studio',
    'studio.subtitle': 'Fiches & Personas',
    'studio.cards': 'Fiches',
    'studio.characters': 'Personnages',
    'studio.personas': 'Personas',
    'studio.lorebooks': 'Lorebooks',
    'studio.codex': 'Codex',
    'studio.myCards': 'Mes Fiches Personnages',
    'studio.myCardsSub': 'Personnages créés par vous',
    'studio.noCards': 'Aucune fiche créée',
    'studio.noCardsSub': 'Créez votre compagnon de roleplay avec son univers, sa personnalité et son premier message.',
    'studio.createCard': 'Créer une fiche',
    'studio.importCard': 'Importer',
    'studio.codexTitle': 'Lorebooks Codex',
    'studio.codexSub': 'Univers & mémoires par mots-clés',
    'studio.addLorebook': 'Ajouter Lorebook',
    'studio.noLorebooks': 'Aucun Lorebook',
    'studio.createFirstLorebook': 'Créer un Lorebook',
    'studio.create': 'Créer',
    'studio.import': 'Importer',
    'settings.title': 'Paramètres',
    'settings.subtitle': 'Moteur IA, Voix, Personas & Sauvegardes',
    'settings.healthTitle': 'État des Services & Latence',
    'settings.controlPanel': 'PARAMÈTRES & CONTRÔLE',
    'settings.aiEngine': 'Moteur IA',
    'settings.aiEngineSub': 'LLM, Art de scène & Voix',
    'settings.theming': 'Thème',
    'settings.themingSub': 'Palette & Couleurs UI',
    'settings.dataVault': 'Coffre de Données',
    'settings.dataVaultSub': 'Sauvegarde & Import local',
    'settings.personas': 'Personas',
    'settings.personasSub': 'Gérer et changer de profil',
    'settings.tokens': 'Tokens & Sampling',
    'settings.tokensSub': 'Contexte & Paramètres',
    'settings.about': 'À propos de Neko',
    'settings.languageTitle': 'Langue & Prompt IA',
    'settings.languageSub': "Changer la langue de l'interface et guider les réponses IA",
    'settings.autoPromptLabel': 'Ajouter automatiquement la consigne de langue',
    'settings.autoPromptHint': "Ajoute le prompt modifiable ci-dessous pour que l'IA réponde dans la langue choisie.",
    'settings.customPromptLabel': 'Prompt de langue personnalisé (Modifiable)',
    'settings.resetPrompt': 'Réinitialiser',
    'settings.saveLanguage': 'Enregistrer la langue',
    'settings.aiModalTitle': 'Moteur IA & Médias',
    'settings.textLlm': 'LLM Texte',
    'settings.sceneArt': 'Art de scène',
    'settings.voiceTts': 'Voix TTS',
    'settings.selectProvider': 'Profil du fournisseur',
    'settings.baseUrl': 'URL de base (Endpoint)',
    'settings.apiKey': 'Clé secrète API',
    'settings.modelId': 'Identifiant du modèle',
    'settings.fetchModels': 'Charger les modèles',
    'settings.testConn': 'Tester la connexion',
    'settings.saveApi': 'Enregistrer la config API',
    'settings.applyTheme': 'Appliquer le thème',
    'settings.selectThemeSub': 'Choisir un thème (Instantané)',
    'settings.maxOutputTokens': 'Tokens max de sortie',
    'settings.unlimited': 'Illimité',
    'studio.charModalNew': 'Créer un personnage',
    'studio.charAvatar': 'Avatar du personnage',
    'studio.uploadImage': 'Importer une image',
    'studio.charName': 'Nom du personnage *',
    'studio.tagline': 'Accroche / Titre',
    'studio.scenario': 'Scénario & Contexte initial',
    'studio.personality': 'Personnalité & Traits',
    'studio.firstMsg': 'Premier message',
    'studio.tagsLabel': 'Tags (séparés par virgule)',
    'studio.saveChar': 'Enregistrer le personnage',
    'studio.importModalTitle': 'Importer une fiche',
    'studio.uploadFileBtn': 'Importer un fichier .JSON ou .PNG',
    'studio.orPaste': 'Ou coller le JSON / texte W++',
    'studio.parseLoad': 'Analyser & Charger',
    'discover.allTags': 'Tous les tags',
    'chat.typeMessage': 'Écrire un message...',
    'chat.writing': 'Écrit...',
    'chat.settings': 'Paramètres',
    'chat.memory': 'Mémoire',
    'chat.customize': 'Personnaliser',
    'chat.applyClose': 'Appliquer & Fermer',
    'chat.controlTitle': 'Contrôle du chat & Contexte',
    'chat.generationControls': 'Paramètres de génération',
    'chat.instructions': 'Instructions',
    'chat.customPrompt': 'Prompt personnalisé',
    'chat.prefill': 'Pré-remplissage (Prefill)',
    'chat.forbiddenWords': 'Mots interdits',
    'chat.options': 'Options',
    'chat.autoscroll': 'Défilement auto',
    'chat.textStreaming': 'Streaming du texte',
    'chat.readingLayout': 'Mise en page',
    'chat.chatBubbles': 'Bulles de chat',
    'chat.novelView': 'Mode Roman',
    'chat.bgImage': 'Image de fond',
    'chat.copy': 'Copier',
    'chat.branch': 'Branche',
    'chat.voice': 'Voix',
    'chat.regenerate': 'Régénérer',
    'chat.continue': 'Continuer',
    'chat.edit': 'Modifier',
    'chat.delete': 'Supprimer',
  },
  id: {
    'nav.chats': 'Obrolan',
    'nav.discover': 'Jelajah',
    'nav.studio': 'Studio',
    'nav.settings': 'Pengaturan',
    'chats.subtitle': 'AI Pendamping & Roleplay',
    'chats.explore': 'Jelajahi',
    'chats.myChats': 'Obrolan Saya',
    'chats.active': 'aktif',
    'chats.empty': 'Kosong',
    'chats.noActiveTitle': 'Belum Ada Obrolan',
    'chats.noActiveSub': 'Temukan karakter anime dari katalog komunitas atau buat karaktermu sendiri di Studio.',
    'chats.exploreCatalog': 'Jelajahi Katalog',
    'chats.createCard': 'Buat Kartu',
    'chats.startNewChat': 'Mulai chat baru',
    'chats.details': 'Detail',
    'chats.latest': 'Terbaru',
    'chats.oldest': 'Terlama',
    'chats.mostMsgs': 'Pesan terbanyak',
    'chats.select': 'Pilih',
    'chats.done': 'Selesai',
    'discover.catalogGrid': 'Katalog',
    'discover.forYou': 'Untukmu',
    'discover.matchMode': 'Match',
    'discover.exploreAll': 'Jelajahi Semua',
    'discover.myLibrary': 'Koleksi Saya',
    'discover.searchPlaceholder': 'Cari karakter, tag, kreator (@creator)...',
    'discover.characters': 'Karakter',
    'discover.creators': 'Kreator',
    'discover.trending': 'Trending',
    'discover.popular': 'Populer',
    'discover.latest': 'Terbaru',
    'studio.title': 'Studio',
    'studio.subtitle': 'Kartu Karakter & Persona',
    'studio.cards': 'Kartu',
    'studio.characters': 'Karakter',
    'studio.personas': 'Persona',
    'studio.lorebooks': 'Lorebook',
    'studio.codex': 'Codex',
    'studio.myCards': 'Kartu Karakter Saya',
    'studio.myCardsSub': 'Karakter buatanmu sendiri',
    'studio.noCards': 'Belum Ada Kartu Kustom',
    'studio.noCardsSub': 'Buat karakter anime pendampingmu sendiri lengkap dengan lore, sifat, dan pesan pembuka.',
    'studio.createCard': 'Buat Kartu',
    'studio.importCard': 'Impor Kartu',
    'studio.codexTitle': 'Lorebook Codex',
    'studio.codexSub': 'Lore dunia & memori pemicu kata kunci',
    'studio.addLorebook': 'Tambah Lorebook',
    'studio.noLorebooks': 'Belum Ada Lorebook',
    'studio.createFirstLorebook': 'Buat Lorebook Pertama',
    'studio.create': 'Buat',
    'studio.import': 'Impor',
    'settings.title': 'Pengaturan',
    'settings.subtitle': 'Kelola Mesin AI, Suara, Persona & Vault',
    'settings.healthTitle': 'Monitor Status & Latensi Layanan',
    'settings.controlPanel': 'PENGATURAN & PANEL KONTROL',
    'settings.aiEngine': 'Mesin AI',
    'settings.aiEngineSub': 'LLM, Gambar Adegan & Suara',
    'settings.theming': 'Tema',
    'settings.themingSub': 'Palet & Aksen Warna UI',
    'settings.dataVault': 'Brankas Data',
    'settings.dataVaultSub': 'Cadangkan & Impor lokal',
    'settings.personas': 'Persona Pengguna',
    'settings.personasSub': 'Kelola profil & ganti persona',
    'settings.tokens': 'Token & Sampling',
    'settings.tokensSub': 'Batas konteks & parameter',
    'settings.about': 'Tentang Neko',
    'settings.languageTitle': 'Bahasa Aplikasi & Prompt AI',
    'settings.languageSub': 'Ubah bahasa UI & atur instruksi bahasa otomatis ke AI',
    'settings.autoPromptLabel': 'Otomatis tambah instruksi bahasa ke pesan AI',
    'settings.autoPromptHint': 'Menambahkan prompt di bawah secara otomatis agar AI membalas sesuai bahasa UI.',
    'settings.customPromptLabel': 'Custom Prompt Bahasa (Bisa Diedit)',
    'settings.resetPrompt': 'Reset ke default',
    'settings.saveLanguage': 'Simpan Pengaturan Bahasa',
    'settings.aiModalTitle': 'Pengaturan Mesin AI & Media',
    'settings.textLlm': 'Teks LLM',
    'settings.sceneArt': 'Gambar Adegan',
    'settings.voiceTts': 'Suara TTS',
    'settings.selectProvider': 'Pilih Profil Provider',
    'settings.baseUrl': 'Base URL (Endpoint)',
    'settings.apiKey': 'API Secret Key',
    'settings.modelId': 'ID Model',
    'settings.fetchModels': 'Ambil Model',
    'settings.testConn': 'Tes Koneksi Otomatis',
    'settings.saveApi': 'Simpan Konfigurasi API',
    'settings.applyTheme': 'Terapkan Tema',
    'settings.selectThemeSub': 'Pilih Tema (Langsung Berubah)',
    'settings.maxOutputTokens': 'Batas Token Output',
    'settings.unlimited': 'Tak Terbatas',
    'studio.charModalNew': 'Buat Karakter Baru',
    'studio.charAvatar': 'Avatar Karakter',
    'studio.uploadImage': 'Unggah Gambar',
    'studio.charName': 'Nama Karakter *',
    'studio.tagline': 'Tagline / Judul',
    'studio.scenario': 'Skenario & Konteks Awal',
    'studio.personality': 'Kepribadian & Sifat',
    'studio.firstMsg': 'Pesan Pembuka Pertama',
    'studio.tagsLabel': 'Tag (pisahkan koma)',
    'studio.saveChar': 'Simpan Karakter',
    'studio.importModalTitle': 'Impor Kartu Karakter',
    'studio.uploadFileBtn': 'Unggah File .JSON atau .PNG',
    'studio.orPaste': 'Atau Tempel Teks JSON / W++',
    'studio.parseLoad': 'Proses & Muat ke Studio',
    'discover.allTags': 'Semua Tag',
    'chat.typeMessage': 'Ketik pesan...',
    'chat.writing': 'Mengetik...',
    'chat.settings': 'Pengaturan',
    'chat.memory': 'Memori',
    'chat.customize': 'Kustomisasi',
    'chat.applyClose': 'Terapkan & Tutup',
    'chat.controlTitle': 'Kontrol Chat & Konteks',
    'chat.generationControls': 'Kontrol generasi',
    'chat.instructions': 'Instruksi',
    'chat.customPrompt': 'Prompt kustom',
    'chat.prefill': 'Prefill balasan',
    'chat.forbiddenWords': 'Kata terlarang',
    'chat.options': 'Opsi',
    'chat.autoscroll': 'Gulir otomatis',
    'chat.textStreaming': 'Streaming teks',
    'chat.readingLayout': 'Tampilan baca',
    'chat.chatBubbles': 'Gelembung Chat',
    'chat.novelView': 'Tampilan Novel',
    'chat.bgImage': 'Gambar latar',
    'chat.copy': 'Salin',
    'chat.branch': 'Cabang',
    'chat.voice': 'Suara',
    'chat.regenerate': 'Ulangi',
    'chat.continue': 'Lanjutkan',
    'chat.edit': 'Edit',
    'chat.delete': 'Hapus',
  },
};
