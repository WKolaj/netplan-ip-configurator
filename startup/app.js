const log = require("../logger/logger");
const {
  InterProcessCommunicator,
} = require("../classes/InterProcessCommunicator/InterProcessCommunicator");
const path = require("path");

const onDataInput = async (data) => {
  return "Data exchanged successfully!";
};

const onDataOutput = async () => {
  return { data: "New data send to client 1" };
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

  //#region ========== INITIALIZING NETPLAN ==========

  await require("./netplan")();

  //#endregion ========== INITIALIZING NETPLAN ==========

  //#region ========== INITIALIZING INTER PROCESS COMMUNICATION ==========

  await require("./interProcessCommunication")();

  //#endregion ========== INITIALIZING INTER PROCESS COMMUNICATION ==========
};
