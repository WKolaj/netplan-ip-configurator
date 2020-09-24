const interprocessCommunicationService = require("../services/interprocessCommunicationService");
const logger = require("../logger/logger");

module.exports = async function () {
  logger.info("initializing inter process communication...");

  await interprocessCommunicationService.init();

  logger.info("inter process communication initialized");
};
