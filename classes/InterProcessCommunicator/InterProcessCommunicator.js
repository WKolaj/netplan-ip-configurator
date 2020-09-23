const http = require("http");
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
 * @description Method for deciding whether request should be permitted to process or not - token should exists in header and be valid
 * @param {Object} request Request to check
 */
const permitRequest = (request) => {
  let authToken = request.headers["x-auth-token"];
  if (authToken !== appAuthToken) return false;

  return true;
};

/**
 * @description Method for checking if request has JSON Content-Type
 * @param {Object} request Request to check
 */
const isRequestJSON = (request) => {
  let contentType = request.headers["content-type"];
  if (contentType !== "application/json") return false;

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
    this._onDataOutput = null;
  }

  /**
   * @description Method called on data came async(data) - POST
   */
  get OnDataInput() {
    return this._onDataInput;
  }

  /**
   * @description Method called on data came async(data) - POST
   */
  set OnDataInput(value) {
    this._onDataInput = value;
  }

  /**
   * @description Method called on data leave async(data) - GET
   */
  get OnDataOutput() {
    return this._onDataOutput;
  }

  /**
   * @description Method called on data leave async(data) - GET
   */
  set OnDataOutput(value) {
    this._onDataOutput = value;
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

      this._comServer = http.createServer(function (request, response) {
        //Checking auth token
        if (!permitRequest(request)) {
          response.statusCode = 403;
          return response.end("Access forbidden.");
        }

        let content = "";
        //On every piece of data - extend content
        request.on("data", (buf) => {
          content += buf.toString();
        });

        //Handling error during communication
        request.on("error", self._handleDataInputError);

        //On stream end - invoke data input change
        request.on("end", async () => {
          //Invoking data input handler - based on method
          if (request.method === "POST") {
            //exiting if content is not a valid json
            if (!isRequestJSON(request) || !isValidJson(content)) {
              response.code = 400;
              return response.end("Invalid data format.");
            }

            let result = await self._handleDataInput(content);
            response.statusCode = 200;
            return response.end(JSON.stringify(result));
          } else if (request.method === "GET") {
            let result = await self._handleDataOutput();
            response.statusCode = 200;
            response.setHeader("content-type", "application/json");
            return response.end(JSON.stringify(result));
          } else {
            response.statusCode = 400;
            return response.end("invalid http function");
          }
        });
      });

      this.ComServer.listen(self.SocketFilePath);
    }
  };

  /**
   * @description Method for handling data input - on the end of exchange process - POST
   */
  _handleDataInput = async (data) => {
    try {
      let jsonData = JSON.parse(data);

      //Firing method 'OnDataInput' event on the end of data collecting
      if (this.OnDataInput) return this.OnDataInput(jsonData);
      else return {};
    } catch (err) {
      logger.error(err.message, err);
    }
  };

  /**
   * @description Method for handling data output - on the end of exchange process - GET
   */
  _handleDataOutput = async () => {
    try {
      //Firing method 'OnDataOutput' event on the end of data collecting
      if (this.OnDataOutput) return this.OnDataOutput();
      else return {};
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

  /**
   * @description Method for handling error during communication
   * @param {Object} err communication error
   */
  _handleDataOutputError = (err) => {
    logger.error(err.message, err);
  };
}

module.exports.InterProcessCommunicator = InterProcessCommunicator;
