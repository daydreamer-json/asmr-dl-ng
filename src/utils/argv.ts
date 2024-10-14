type argvType = {
  [prop: string]: any;
};
let argv: argvType | null = null;
function setArgv(argvIn: object) {
  argv = argvIn;
}
function getArgv() {
  if (argv === null) throw new Error('argv is null');
  return argv;
}
export default {
  setArgv,
  getArgv,
};
