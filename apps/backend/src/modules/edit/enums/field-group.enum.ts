export enum GameFieldGroupBit {
  IDS = 0, // v_id. b_id
  TITLES = 1, // title_jp, title_zh, title_en
  INTROS = 2, // intro_jp, intro_zh, intro_en
  ALIASES = 3,
  RELEASE = 4,
  TYPE = 5,
  PLATFORMS = 6,
  EXTRA = 7, // extra_info
  TAGS = 8,
  STAFFS = 9,
  MANAGE_LINKS = 10,
  MANAGE_COVERS = 11,
  MANAGE_IMAGES = 12,
  MANAGE_DEVELOPERS = 13,
  MANAGE_CHARACTERS = 14,
  STATUS = 15,
  NSFW = 16,
  VIEWS = 17,
}

export enum GameCharacterFieldGroupBit {
  IDS = 0, // b_id, v_id
  NAMES = 1, // name_jp, name_zh, name_en
  INTROS = 2, // intro_jp, intro_zh, intro_en
  ALIASES = 3,
  IMAGE = 4,
  BODY_METRICS = 5, // height, weight, bust, waist, hips, cup
  AGE_BIRTHDAY = 6,
  BLOOD_TYPE = 7,
  GENDER = 8,
}

export enum GameDeveloperFieldGroupBit {
  IDS = 0, // b_id, v_id
  NAME = 1,
  ALIASES = 2,
  INTROS = 3, // intro_jp, intro_zh, intro_en
  EXTRA = 4,
  LOGO = 5,
  WEBSITE = 6,
}
