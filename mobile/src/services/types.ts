/** Loose entity row — payload fields live alongside hydrate metadata. */
export type EntityRow = Record<string, unknown> & {
  id: string;
  user_id?: string;
  campaign_id?: string | null;
  public_url?: string | null;
  created_date?: string;
  updated_date?: string;
  is_demo?: boolean;
};

export type CampaignListItem = EntityRow & {
  song?: EntityRow;
  artist?: EntityRow;
  release?: EntityRow | null;
  daysCount?: number;
  videosCount?: number;
  progressValue?: number;
  status?: string;
  name?: string;
  artwork_url?: string;
  song_id?: string;
  artist_id?: string;
  release_id?: string;
};
