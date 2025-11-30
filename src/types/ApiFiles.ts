type CommonFile = {
  hash: string;
  title: string; // file name
  work: { id: number; source_id: string; source_type: string };
  workTitle: string;
  mediaStreamUrl: string;
  mediaDownloadUrl: string;
  size: number;
};

type CommonFolder = {
  title: string; // folder name
  children: FilesystemEntry[];
};

type FilesystemEntry =
  | ({ type: 'audio'; streamLowQualityUrl: '' | string; duration: number } & CommonFile)
  | ({ type: 'image' | 'text' | 'other' } & CommonFile)
  | ({ type: 'folder' } & CommonFolder);

// path example: ['folderA', 'subfolderB', 'example.wav']. last element must always be a filename.
type FilesystemEntryTransformed = { path: string[]; uuid: string } & (
  | ({ type: 'audio'; streamLowQualityUrl: '' | string; duration: number } & Omit<
      CommonFile,
      'title' | 'workTitle' | 'work'
    >)
  | ({ type: 'image' | 'text' | 'other' } & Omit<CommonFile, 'title' | 'workTitle' | 'work'>)
);

export type { FilesystemEntry, FilesystemEntryTransformed };
