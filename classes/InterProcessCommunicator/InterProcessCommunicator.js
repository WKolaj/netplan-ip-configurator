const http = require("http");
const path = require("path");
const events = require("events");
const logger = require("../../logger/logger");
const {
  checkIfFileExistsAsync,
  removeFileOrDirectoryAsync,
  isValidJson,
  chmodAsync,
  chownAsync,
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

    this._socketUserID = config.get("socketUserID");
    this._socketUserGroupID = config.get("socketUserGroupID");

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
   * @description User ID who connects to sockets
   */
  get SocketUserID() {
    return this._socketUserID;
  }

  /**
   * @description User Group ID who connects to sockets
   */
  get SocketUserGroupID() {
    return this._socketUserGroupID;
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
              response.statusCode = 400;
              return response.end("Invalid data format.");
            }

            let result = await self._handleDataInput(content);
            response.statusCode = result.code;
            return response.end(JSON.stringify(result.message));
          } else if (request.method === "GET") {
            let result = await self._handleDataOutput();
            response.statusCode = result.code;
            response.setHeader("content-type", "application/json");
            return response.end(JSON.stringify(result.message));
          } else {
            response.statusCode = 400;
            return response.end("invalid http function");
          }
        });
      });

      this.ComServer.listen(self.SocketFilePath, async () => {
        //Mode of file should be changed - in order for other processes to access it
        //Changing owner to user
        await chownAsync(
          this.SocketFilePath,
          this.SocketUserID,
          this.SocketUserGroupID
        );

        //Changing permissions - to only a user can access this file
        await chmodAsync(this.SocketFilePath, "700");
      });
    }
  };

  /**
   * @description Method for handling data input - on the end of exchange process - POST
   */
  _handleDataInput = async (data) => {
    try {
      let jsonData = JSON.parse(data);

      //Firing method 'OnDataInput' event on the end of data collecting
      if (this.OnDataInput) {
        let dataToReturn = await this.OnDataInput(jsonData);
        if (!dataToReturn || dataToReturn === {} || !dataToReturn.code) {
          return { code: 200, message: {} };
        }

        return dataToReturn;
      } else return { code: 200, message: {} };
    } catch (err) {
      logger.error(err.message, err);
      return { code: 500, message: "UPS... Something went wrong..." };
    }
  };

  /**
   * @description Method for handling data output - on the end of exchange process - GET
   */
  _handleDataOutput = async () => {
    try {
      if (this.OnDataOutput) {
        //Firing method 'OnDataOutput' event on the end of data collecting
        let dataToReturn = await this.OnDataOutput();
        if (!dataToReturn || dataToReturn === {} || !dataToReturn.code) {
          return { code: 200, message: {} };
        }

        return dataToReturn;
      } else return { code: 200, message: {} };
    } catch (err) {
      logger.error(err.message, err);
      return { code: 500, message: "UPS... Something went wrong..." };
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
