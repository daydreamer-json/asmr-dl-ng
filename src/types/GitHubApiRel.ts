interface SimpleUser {
  avatar_url: string;
  events_url: string;
  followers_url: string;
  following_url: string;
  gists_url: string;
  gravatar_id: string | null;
  html_url: string;
  id: number;
  node_id: string;
  login: string;
  organizations_url: string;
  received_events_url: string;
  repos_url: string;
  site_admin: boolean;
  starred_url: string;
  subscriptions_url: string;
  type: string;
  url: string;
  name?: string | null;
  email?: string | null;
  starred_at?: string;
  user_view_type?: string;
}

interface ReleaseAsset {
  url: string;
  browser_download_url: string;
  id: number;
  node_id: string;
  name: string;
  label: string | null;
  state: 'uploaded' | 'open';
  content_type: string;
  size: number;
  digest: string | null;
  download_count: number;
  created_at: string;
  updated_at: string;
  uploader: SimpleUser | null;
}

interface Release {
  url: string;
  html_url: string;
  assets_url: string;
  upload_url: string;
  tarball_url: string | null;
  zipball_url: string | null;
  id: number;
  node_id: string;
  tag_name: string;
  target_commitish: string;
  name: string | null;
  body: string | null;
  draft: boolean;
  prerelease: boolean;
  immutable: boolean;
  created_at: string;
  published_at: string | null;
  updated_at: string | null;
  author: SimpleUser;
  assets: ReleaseAsset[];
  body_html: string;
  body_text: string;
  mentions_count: number;
  discussion_url: string;
  reactions: any;
}

export type { Release };
