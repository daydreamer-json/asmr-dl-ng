const serverNameArray = ['latest', 'original', 'mirror1', 'mirror2', 'mirror3'] as const;
type ServerName = (typeof serverNameArray)[number];

const orderNameArray = [
  'release',
  'create_date',
  'rating',
  'dl_count',
  'price',
  'rate_average_2dp',
  'review_count',
  'id',
  'nsfw',
  'random',
  'betterRandom',
] as const;
type OrderName = (typeof orderNameArray)[number];

export type { ServerName, OrderName };
export { serverNameArray, orderNameArray };
