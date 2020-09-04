const net = require("net");
const path = require("path");
const events = require("events");
const logger = require("../../logger/logger");
const {
  checkIfFileExistsAsync,
  removeFileOrDirectoryAsync,
} = require("../../utilities/utilities");
const config = require("config");

/**
 * @description class for exchanging data with other processes via file exchange
 */
class InterProcessCommunicator {
  constructor() {
    this._socketDirPath = config.get("socketDirPath");
    this._socketFileName = config.get("socketFileName");
    this._socketFilePath = path.join(this.SocketDirPath, this.SocketFileName);

    this._eventEmitter = new events.EventEmitter();

    this._comServer = null;
  }

  get ComServer() {
    return this._comServer;
  }

  get SocketDirPath() {
    return this._socketDirPath;
  }

  get SocketFileName() {
    return this._socketFileName;
  }

  get SocketFilePath() {
    return this._socketFilePath;
  }

  get EventEmitter() {
    return this._eventEmitter;
  }

  start = async () => {
    if (!this.ComServer) {
      let self = this;

      //Removing socket file if exists - to close previously opened socket
      if (await checkIfFileExistsAsync(self.SocketFilePath))
        await removeFileOrDirectoryAsync(self.SocketFilePath);

      this._comServer = net.createServer(function (stream) {
        let content = "";

        //On every piece of data - extend content
        stream.on("data", (buf) => {
          content += buf.toString();
        });

        stream.on("error", self._handleDataInputError);

        //On stream end - invoke data input change
        stream.on("end", () => self._handleDataInput(content));
      });

      this.ComServer.listen(self.SocketFilePath);
    }
  };

  _handleDataInput = (data) => {
    try {
      let jsonData = JSON.parse(data);
      this.EventEmitter.emit("data", jsonData);
    } catch (err) {
      logger.error(err.message, err);
    }
  };

  _handleDataInputError = (err) => {
    logger.error(err.message, err);
  };

  stop = () => {
    if (this.ComServer) {
      this.ComServer.close();
      this._comServer = null;
    }
  };
}

module.exports.InterProcessCommunicator = InterProcessCommunicator;
