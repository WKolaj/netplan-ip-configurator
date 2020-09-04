const log = require("../logger/logger");
const {
  InputDataManager,
} = require("../classes/InputDataManager/InputDataManager");
const path = require("path");

const onDataInput = (data) => {
  console.log(JSON.stringify(data));
};

//Main method for initializing whole application
module.exports = async function (workingDirName) {
  //#region ========== INITIAL SETTINGS ==========

  //Setting working directory as a default dir name if it was not set
  if (!workingDirName) workingDirName = __dirname;

  //#endregion ========== INITIAL SETTINGS ==========

  //#region ========== INITIALIZING LOGGING ==========

  await require("./logs")();

  //#endregion ========== INITIALIZING LOGGING ==========

  //#region ========== INITIALIZING CONFIG ==========

  await require("./config")();

  //#endregion ========== INITIALIZING CONFIG ==========

  //#region ========== INITIALIZING INPUT DATA MANAGER ==========

  const inputDataManager = new InputDataManager();
  inputDataManager.EventEmitter.on("dataInput", onDataInput);
  inputDataManager.start();

  log.info("input data manager initialized");

  //#endregion ========== INITIALIZING INPUT DATA MANAGER==========
};
