type TypeOriginalTrackEntry = {
  type: 'audio' | 'image' | 'text' | 'folder';
  hash: string;
  title: string;
  work: {
    id: number;
    source_id: string;
    source_type: string;
  };
  workTitle: string;
  mediaStreamUrl: string;
  mediaDownloadUrl: string;
  streamLowQualityUrl?: string;
  duration?: number;
  size?: number;
  children?: Array<TypeOriginalTrackEntry>;
};

type TypeModifiedTrackEntry = {
  uuid: string;
  type: 'audio' | 'image' | 'text' | 'folder';
  hash: string;
  title: string;
  path: string;
  work: {
    id: number;
    source_id: string;
    source_type: string;
  };
  workTitle: string;
  mediaStreamUrl: string;
  mediaDownloadUrl: string;
  streamLowQualityUrl?: string;
  duration?: number;
  size?: number;
  children?: Array<TypeModifiedTrackEntry> | null;
};

type TypeOptimizedTrackEntry = {
  uuid: string;
  path: string;
  url: string;
  hash: string;
};

export type { TypeOriginalTrackEntry, TypeModifiedTrackEntry, TypeOptimizedTrackEntry };
