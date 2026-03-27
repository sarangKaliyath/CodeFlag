let flags = [];

function getFlags() {
	return flags;
}

function addFlag(flag) {
	if(!flag) return;
    flags.push(flag);
}

function removeFlag(index = 0) {
    if(index < 0 || index > flags.length) return;
	flags.splice(index, 1);
}

module.exports = {
	getFlags,
	addFlag,
	removeFlag
};