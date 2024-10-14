function numberToRJIdString(id: number) {
  if (id < 1000000) {
    return 'RJ' + id;
  } else {
    return 'RJ0' + id;
  }
}

export default {
  numberToRJIdString,
};
