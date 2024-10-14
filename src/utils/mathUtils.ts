const mathUtils = {
  arrayMax(array: Array<number>) {
    return array.reduce((a, b) => Math.max(a, b));
  },

  arrayMin(array: Array<number>) {
    return array.reduce((a, b) => Math.min(a, b));
  },

  arrayTotal(array: Array<number>) {
    return array.reduce((acc, f) => acc + f, 0);
  },

  arrayAvg(array: Array<number>) {
    return this.arrayTotal(array) / array.length;
  },

  rounder(method: 'floor' | 'ceil' | 'round', num: number, n: number) {
    const pow = Math.pow(10, n);
    let result: number;
    switch (method) {
      case 'floor':
        result = Math.floor(num * pow) / pow;
        break;
      case 'ceil':
        result = Math.ceil(num * pow) / pow;
        break;
      case 'round':
        result = Math.round(num * pow) / pow;
        break;
    }
    return {
      orig: result,
      padded: result.toFixed(n),
    };
  },

  formatFileSize(bytes: number, decimals: number = 2) {
    if (bytes === 0) return '0 byte';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['bytes', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  },

  formatFileSizeFixedUnit(
    bytes: number,
    unit: 'bytes' | 'KiB' | 'MiB' | 'GiB' | 'TiB' | 'PiB' | 'EiB' | 'ZiB' | 'YiB' = 'MiB',
    decimals: number = 2,
  ) {
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['bytes', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];
    const i = sizes.indexOf(unit);
    return (bytes / Math.pow(k, i)).toFixed(dm) + ' ' + sizes[i];
  },
};

export default mathUtils;
