//App was exported to external module - for testing to be possible
const appStart = require("./startup/app");

module.exports = appStart(__dirname);
