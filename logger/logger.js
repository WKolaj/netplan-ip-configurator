const winston = require("winston");
const { createLogger, format, transports } = winston;
const config = require("config");

let logger = null;

//#region ========== WINSTON LOGGER ==========

//Winston logger is used to log items to console or to file - depending on enviroment

//Logger for console will not be displayed as json, but it will be colorized
//Moreover - logging on console is not active on production enviroment!!
//For test enviroment - log only erros and warnings
if (process.env.NODE_ENV === "production") {
  logger = createLogger({
    level: "info",
    format: format.combine(format.timestamp(), format.json()),
    transports: [
      new transports.File({
        filename: config.get("logging.error.path"),
        level: "error",
        maxsize: config.get("logging.error.maxsize"),
        maxFiles: config.get("logging.error.maxFiles"),
        handleExceptions: true,
      }),
      new transports.File({
        filename: config.get("logging.warning.path"),
        level: "warn",
        maxsize: config.get("logging.warning.maxsize"),
        maxFiles: config.get("logging.warning.maxFiles"),
      }),
      new transports.File({
        filename: config.get("logging.info.path"),
        maxsize: config.get("logging.info.maxsize"),
        maxFiles: config.get("logging.info.maxFiles"),
      }),
    ],
  });
} else if (process.env.NODE_ENV === "test") {
  logger = {
    info: (text) => {
      //Info should not be logged - it would trash output while automated testing
    },
    error: (text, errorDetails) => {
      console.log(errorDetails);
    },
    warn: (text, errorDetails) => {
      console.log(errorDetails);
    },
  };
} else {
  logger = createLogger({
    level: "info",
    format: format.combine(format.timestamp(), format.json()),
    transports: [
      new transports.Console({
        format: format.combine(format.colorize(), format.simple()),
        handleExceptions: true,
      }),
    ],
  });
}

//#endregion ========== WINSTON LOGGER ==========

//#region ========== ROUTE ACTION LOGGER ==========

//Route action logger is used to log actions of user during eg. loggining in
//Loging action can be disabled by setting loggining.logActions to false in config file
let loggingEnabled = config.get("logging.logActions");

/**
 * @description Method for logging info about user actions
 * @param {String} text action text to log
 */
logger.action = (text) => {
  if (loggingEnabled) logger.info(text);
};

//#endregion ========== ROUTE ACTION LOGGER ==========

module.exports = logger;
