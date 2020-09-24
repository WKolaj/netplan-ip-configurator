const netplanService = require("../services/netplanService");
const logger = require("../logger/logger");
const isRoot = require("is-root");

module.exports = async function () {
  logger.info("initializing netplan service...");

  if (!isRoot())
    throw new Error("Process has been run without sudo permissions!");

  await netplanService.init();

  logger.info("netplan service initialized");
};
