let flags = [];

function getFlags() {
  return flags;
}

function addFlag(flag) {
  if (!flag) return;
  flags.push(flag);
}

function removeFlag(index = 0) {
  if (index < 0 || index > flags.length) return;
  flags.splice(index, 1);
}

function updateFlagPositions(uri, changedLine, lineDiff, isLineSplit) {
  const flags = getFlags();

  flags.forEach((flag) => {
    if (flag.uri !== uri) return;

    if (isLineSplit) {
      if (flag.line > changedLine) {
        flag.line += lineDiff;
      }
    } else {
      if (flag.line >= changedLine) {
        flag.line += lineDiff;
      }
    }
  });
}

module.exports = {
  getFlags,
  addFlag,
  removeFlag,
  updateFlagPositions,
};
