type WorkInfoBase = {
  /**
   * DLsite work ID (RJxxxxxxxx)
   * @example 1476812
   */
  id: number;
  /**
   * work title
   * @example '密着カノジョとささやき添い寝。 ～好き好き連呼♡同棲はじめたて純愛いちゃらぶえっち～'
   */
  title: string;
  /**
   * circle ID
   * @example 46007
   */
  circle_id: number;
  /**
   * circle name
   * @example 'いちのや'
   */
  name: string;
  /**
   * is work nsfw flagged?
   * in most works, this is true
   * @example true
   */
  nsfw: boolean;
  /**
   * release date on DLsite
   * @example '2025-10-08'
   */
  release: string;
  /**
   * downloaded count (actual results)
   * @example 2217
   */
  dl_count: number;
  /**
   * price (JPY)
   * @example 1144
   */
  price: number;
  /**
   * public review count
   * @example 5
   */
  review_count: number;
  /**
   * number of public rating
   * @example 153
   */
  rate_count: number;
  /**
   * average rating (1-5)
   * @example 4.91
   */
  rate_average_2dp: number;
  /**
   * how many times each rating has been given
   */
  rate_count_detail: {
    review_point: 1 | 2 | 3 | 4 | 5;
    count: number;
    /**
     * 0 to 100
     */
    ratio: number;
  }[];
  /**
   * Highest ranking achieved
   */
  rank: {
    term: 'day' | 'week' | 'month' | string;
    category: string;
    rank: number;
    rank_date: string;
  }[];
  has_subtitle: boolean;
  /**
   * the date it was registered in the database and became available. this is usually later than the `release` date
   * @example '2025-11-01'
   */
  create_date: string;
  /**
   * voice actors represented as pairs of UUIDv4 and name
   * @example [{ id: '2b5e7ab5-d994-5491-a53c-f1b6ae562d0e', name: '一之瀬りと' }]
   */
  vas: { id: string; name: string }[];
  /**
   * work tags
   */
  tags: {
    id: number;
    /**
     * localized tag names including revision history of names
     */
    i18n: Record<'en-us' | 'ja-jp' | 'zh-cn', { name: string; history?: { name: string; deprecatedAt: number }[] }>;
    name: string;
    upvote: number;
    downvote: number;
    /**
     * `upvote` - `downvote`
     */
    voteRank: number;
    voteStatus: number;
  }[];
  language_editions: {
    lang: 'JPN' | 'ENG' | 'CHI_HANS' | 'CHI_HANT' | 'KO_KR' | string;
    label: string;
    workno: string;
    edition_id: number;
    edition_type: 'language' | string;
    display_order: number;
  }[];
  original_workno: null | unknown; //!
  other_language_editions_in_db: unknown[]; //!
  translation_info: {
    lang: null | unknown; //!
    is_child: boolean;
    is_parent: boolean;
    is_original: boolean;
    is_volunteer: boolean;
    child_worknos: unknown[]; //!
    parent_workno: null | unknown; //!
    original_workno: null | unknown; //!
    is_translation_agree: boolean;
    translation_bonus_langs: unknown[]; //!
    is_translation_bonus_child: boolean;
    translation_status_for_translator: unknown[]; //!
  };
  work_attributes: string;
  age_category_string: 'general' | 'r15' | 'adult';
  /**
   * total duration of audio files (in seconds)
   */
  duration: number;
  source_type: 'DLSITE';
  /**
   * `id` with the `RJ` prefix appended (almost)
   */
  source_id: string;
  /**
   * `https://www.dlsite.com/maniax/work/=/product_id/${source_id}.html`
   */
  source_url: string;
  circle: {
    /**
     * completely equivalent to `circle_id` value
     */
    id: number;
    /**
     * completely equivalent to root `name` value
     */
    name: string;
    /**
     * circle `id` with the `RG` prefix appended
     */
    source_id: string;
    source_type: 'DLSITE';
  };

  samCoverUrl: string;
  thumbnailCoverUrl: string;
  mainCoverUrl: string;
};

export type { WorkInfoBase };
