const net = require("net");
const path = require("path");
const events = require("events");
const logger = require("../../logger/logger");
const {
  checkIfFileExistsAsync,
  removeFileOrDirectoryAsync,
  isValidJson,
} = require("../../utilities/utilities");
const config = require("config");
const Joi = require("joi");

/**
 * @description schema for communication message
 */
const messageSchema = Joi.object({
  token: Joi.string().required(),
  message: Joi.object().required(),
});

/**
 * @description Method for deciding whether message should be permitted to process or not - token should exists and be valid
 * @param {Object} message Message in form of a JSON
 */
const permitMessage = (message) => {
  let result = messageSchema.validate(message);
  if (result.error) return false;
  if (message.token !== appAuthToken) return false;

  return true;
};

/**
 * @description token used for authorization
 */
const appAuthToken = config.get("appAuthToken");

/**
 * @description class for exchanging data with other processes via local socket
 */
class InterProcessCommunicator {
  constructor() {
    this._socketDirPath = config.get("socketDirPath");
    this._socketFileName = config.get("socketFileName");
    this._socketFilePath = path.join(this.SocketDirPath, this.SocketFileName);

    this._comServer = null;
    this._onDataInput = null;
  }

  /**
   * @description Method called on data came async(data)
   */
  get OnDataInput() {
    return this._onDataInput;
  }

  /**
   * @description Method called on data came async(data)
   */
  set OnDataInput(value) {
    this._onDataInput = value;
  }

  /**
   * @description inter process communication server
   */
  get ComServer() {
    return this._comServer;
  }

  /**
   * @description socket directory path
   */
  get SocketDirPath() {
    return this._socketDirPath;
  }

  /**
   * @description socket file name
   */
  get SocketFileName() {
    return this._socketFileName;
  }

  /**
   * @description socket file path
   */
  get SocketFilePath() {
    return this._socketFilePath;
  }

  /**
   * @description Method for starting inter process communication
   */
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

        //Handling error during communication
        stream.on("error", self._handleDataInputError);

        //On stream end - invoke data input change
        stream.on("end", async () => await self._handleDataInput(content));
      });

      this.ComServer.listen(self.SocketFilePath);
    }
  };

  /**
   * @description Method for handling data input - on the end of exchange process
   */
  _handleDataInput = async (data) => {
    try {
      //exiting if data is not a valid json
      if (!isValidJson(data)) return;

      let jsonData = JSON.parse(data);

      //Emit data only in if message is valid
      if (permitMessage(jsonData)) {
        //Firing method 'OnDataInput' event on the end of data collecting
        if (this.OnDataInput) await this.OnDataInput(jsonData.message);
      }
    } catch (err) {
      logger.error(err.message, err);
    }
  };

  /**
   * @description Method for handling error during communication
   * @param {Object} err communication error
   */
  _handleDataInputError = (err) => {
    logger.error(err.message, err);
  };
}

module.exports.InterProcessCommunicator = InterProcessCommunicator;
