const events = require("events");
const path = require("path");
const logger = require("../../logger/logger");
const {
  readFileAsync,
  checkIfFileExistsAsync,
  removeFileOrDirectoryAsync,
  writeFileAsync,
} = require("../../utilities/utilities");
const config = require("config");

class InputDataManager {
  constructor() {
    this._refreshInterval = config.get("fileRefreshInterval");
    this._inputDirPath = config.get("inputDirPath");
    this._readyFileName = config.get("readyFileName");
    this._dataFileName = config.get("dataFileName");
    this._doneFileName = config.get("doneFileName");

    this._dataFilePath = path.join(this.InputDirPath, this.DataFileName);
    this._readyFilePath = path.join(this.InputDirPath, this.ReadyFileName);
    this._doneFilePath = path.join(this.InputDirPath, this.DoneFileName);

    this._refreshLoopHandler = null;

    this._eventEmitter = new events.EventEmitter();
  }

  get RefreshInterval() {
    return this._refreshInterval;
  }

  get InputDirPath() {
    return this._inputDirPath;
  }

  get ReadyFileName() {
    return this._readyFileName;
  }

  get DataFileName() {
    return this._dataFileName;
  }

  get DoneFileName() {
    return this._doneFileName;
  }

  get ReadyFilePath() {
    return this._readyFilePath;
  }

  get DataFilePath() {
    return this._dataFilePath;
  }

  get DoneFilePath() {
    return this._doneFilePath;
  }

  get EventEmitter() {
    return this._eventEmitter;
  }

  _refresh = async () => {
    try {
      let fileExists = await checkIfFileExistsAsync(this.ReadyFilePath);
      if (fileExists) {
        let doneFileContent = { done: true, error: false };

        //another try-catch block to ensure removing ready file if error occurs during reading
        try {
          await this._handleDataInput();
        } catch (error) {
          logger.error(error.message, error);
          doneFileContent = { done: false, error: true };
        }

        //Removing ready file if exists
        if (await checkIfFileExistsAsync(this.ReadyFilePath))
          await removeFileOrDirectoryAsync(this.ReadyFilePath);

        //Removing ready file if exists
        if (await checkIfFileExistsAsync(this.DataFilePath))
          await removeFileOrDirectoryAsync(this.DataFilePath);

        //Creating done file if not exists
        if (!(await checkIfFileExistsAsync(this.DoneFilePath)))
          await writeFileAsync(
            this.DoneFilePath,
            JSON.stringify(doneFileContent),
            "utf8"
          );
      }
    } catch (error) {
      logger.error(error.message, error);
    }
  };

  _handleDataInput = async () => {
    let fileContent = await readFileAsync(this.DataFilePath, "utf8");
    let data = JSON.parse(fileContent);
    this.EventEmitter.emit("dataInput", data);
    await removeFileOrDirectoryAsync(this.DataFilePath);
  };

  start = () => {
    if (!this._refreshLoopHandler) {
      this._refreshLoopHandler = setInterval(
        this._refresh,
        this.RefreshInterval
      );

      this.EventEmitter.emit("start");
    }
  };

  stop = () => {
    if (this._refreshLoopHandler) {
      clearInterval(this._refreshLoopHandler);
      this._refreshLoopHandler = null;

      this.EventEmitter.emit("stop");
    }
  };
}

module.exports.InputDataManager = InputDataManager;
