
//default to v2
module.exports = require('./stk500v2.js');
module.exports.v2 = module.exports;
module.exports.v1 = require('./stk500v1.js');

