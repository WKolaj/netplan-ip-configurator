const logger = require("../logger/logger");
const config = require("config");

//Method for throwing if there is no property of given name in config file
let throwIfConfigDoesNotExist = (configName) => {
  if (!config.get(configName))
    throw new Error(`FATAL ERROR: ${configName} is not defined in config file`);
};

module.exports = async function () {
  logger.info("initializing app configuration files...");

  //#region ========== CUSTOM CONFIG PROPERTIES ==========

  throwIfConfigDoesNotExist("netplanFileName");
  throwIfConfigDoesNotExist("socketFileName");
  throwIfConfigDoesNotExist("socketDirPath");
  throwIfConfigDoesNotExist("socketFileName");
  throwIfConfigDoesNotExist("appAuthToken");

  //#endregion ========== CUSTOM CONFIG PROPERTIES ==========

  //#region ========== LOGGING CONFIG PROPERTIES ==========

  throwIfConfigDoesNotExist("logging");
  throwIfConfigDoesNotExist("logging.logActions");
  throwIfConfigDoesNotExist("logging.info");
  throwIfConfigDoesNotExist("logging.info.path");
  throwIfConfigDoesNotExist("logging.info.maxsize");
  throwIfConfigDoesNotExist("logging.info.maxFiles");
  throwIfConfigDoesNotExist("logging.warning");
  throwIfConfigDoesNotExist("logging.warning.path");
  throwIfConfigDoesNotExist("logging.warning.maxsize");
  throwIfConfigDoesNotExist("logging.warning.maxFiles");
  throwIfConfigDoesNotExist("logging.error");
  throwIfConfigDoesNotExist("logging.error.path");
  throwIfConfigDoesNotExist("logging.error.maxsize");
  throwIfConfigDoesNotExist("logging.error.maxFiles");

  //#endregion ========== LOGGING CONFIG PROPERTIES ==========

  logger.info("app configuration files initialized");
};
