const log = require("../logger/logger");
const {
  InterProcessCommunicator,
} = require("../classes/InterProcessCommunicator/InterProcessCommunicator");
const path = require("path");

const onDataInput = async (data) => {
  console.log(data);

  return "Data exchanged successfully!";
};

const onDataOutput = async () => {
  return { data: "New data send to client" };
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

  const interProcessCommunicator = new InterProcessCommunicator();
  interProcessCommunicator.OnDataInput = onDataInput;
  interProcessCommunicator.OnDataOutput = onDataOutput;
  interProcessCommunicator.start();

  log.info("input data manager initialized");

  //#endregion ========== INITIALIZING INPUT DATA MANAGER==========
};
