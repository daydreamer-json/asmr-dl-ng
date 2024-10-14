import { DateTime } from 'luxon';
import * as TypesTrackEntry from '../types/TrackEntry.js';
import argvUtils from './argv.js';
import path from 'path';
import appConfigDatabase from './configDatabase.js';
import stringUtils from './stringUtils.js';

function genMdTextSingleWork(
  metadataJson: {
    workInfoPruned: Record<string, any>;
    workFolderStructure: Array<TypesTrackEntry.TypeModifiedTrackEntry>;
    date: string;
  },
  optimizedWorkFolderStructureJson: Array<TypesTrackEntry.TypeOptimizedTrackEntry>,
) {
  const outputText = `# ${metadataJson.workInfoPruned.title}

![Cover Image](./cover_main.jpg)

## Info

|Key|Value|
|---|---|
|ID|[${metadataJson.workInfoPruned.source_id}](${metadataJson.workInfoPruned.source_url})|
|Title|${metadataJson.workInfoPruned.title}|
|Circle|${metadataJson.workInfoPruned.circle.name} ([RG${metadataJson.workInfoPruned.circle.id.toString().padStart(5, '0')}](https://www.dlsite.com/maniax/circle/profile/=/maker_id/RG${metadataJson.workInfoPruned.circle.id.toString().padStart(5, '0')}.html))|
|VAs|${(() => {
    let vadisp = null;
    if (
      metadataJson.workInfoPruned.vas.length !== 0 &&
      metadataJson.workInfoPruned.vas[0].id !== '83a442aa-3662-5e17-aece-757bc3cb97cd' &&
      metadataJson.workInfoPruned.vas[0].name !== 'N/A'
    ) {
      vadisp = metadataJson.workInfoPruned.vas.map((obj: { id: string; name: string }) => obj.name).join(', ');
    } else {
      vadisp = '---';
    }
    return vadisp;
  })()}|
|Tags|${(() => {
    let tagdisp = null;
    if (metadataJson.workInfoPruned.tags.length !== 0) {
      tagdisp = metadataJson.workInfoPruned.tags
        .map(
          (obj: {
            id: number;
            i18n: {
              [key: string]: { name: string; history: Array<any> };
            };
            name: string;
          }) => {
            if (Object.keys(obj.i18n).length === 0) {
              return obj.name;
            } else {
              return obj.i18n[argvUtils.getArgv().lang].name;
            }
          },
        )
        .join(', ');
    } else {
      tagdisp = '---';
    }
    return tagdisp;
  })()}|
|Age restrict|${metadataJson.workInfoPruned.age_category_string}|
|Released|${metadataJson.workInfoPruned.release}|
|Created|${metadataJson.workInfoPruned.create_date}|
|Added|${metadataJson.date}|

## File list

${optimizedWorkFolderStructureJson
  .sort((a, b) => {
    return a.path.localeCompare(b.path, 'ja');
  })
  .map(
    (ent) =>
      `${path.dirname(ent.path).replaceAll(path.sep, path.posix.sep)}/[${path.basename(ent.path).replaceAll(path.sep, path.posix.sep)}](./${ent.uuid}${path.extname(ent.path)})  `,
  )
  .join('\n')}
`;
  return outputText;
}

function genMdTextRoot(date: string) {
  const outputText = `---
license: agpl-3.0
language:
  - ja
tags:
  - not-for-all-audiences
pretty_name: ASMR Archive Dataset
size_categories:
  - n>1T
viewer: false
---
# ASMR Media Archive Storage

This repository contains an archive of ASMR works.

All data in this repository is uploaded for **educational and research purposes only.** **All use is at your own risk.**

Updated at: **${date}**

> [!IMPORTANT]
> This repository contains **many terabytes** of files.  
> Git LFS consumes twice as much disk space because of the way it works, so \`git clone\` is not recommended. [Hugging Face CLI](https://huggingface.co/docs/huggingface_hub/guides/cli) or [Python libraries](https://huggingface.co/docs/huggingface_hub/index) allow you to select and download only a subset of files.

## Works list

|Create Date|Release Date|ID|Title|
|---|---|---|---|
${appConfigDatabase
  .getConfig()
  .map(
    (entry) =>
      // `|![Thumbnail](${entry.workInfoPruned.samCoverUrl})|${entry.workInfoPruned.create_date}|${entry.workInfoPruned.source_id}|[${entry.workInfoPruned.title}](./output/${entry.workInfoPruned.create_date}/${stringUtils.numberToRJIdString(entry.workInfoPruned.id)}/README.md)|`,
      `|${entry.workInfoPruned.create_date}|${entry.workInfoPruned.release}|${entry.workInfoPruned.source_id}|[${entry.workInfoPruned.title}](./output/${entry.workInfoPruned.create_date}/${stringUtils.numberToRJIdString(entry.workInfoPruned.id)}/README.md)|`,
  )
  .join('\n')};
`;
  return outputText;
}

export default {
  genMdTextSingleWork,
  genMdTextRoot,
};
