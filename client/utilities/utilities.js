const http = require("http");

module.exports.sendHTTPGetToSocket = async (socketPath, route, headers) => {
  return new Promise(async (resolve, reject) => {
    try {
      let options = {
        method: "GET",
        socketPath: socketPath,
        path: route,
        headers: headers,
      };

      //creating callback
      let callback = function (response) {
        var str = "";

        response.on("data", function (chunk) {
          str += chunk;
        });

        response.on("end", function () {
          return resolve({ code: response.statusCode, message: str });
        });

        response.on("error", function (err) {
          return reject(err);
        });
      };

      //Creating request
      let request = http.request(options, callback);

      //in case request throws an error
      request.on("error", function (err) {
        return reject(err);
      });

      request.end();
    } catch (err) {
      return reject(err);
    }
  });
};

module.exports.sendHTTPPostToSocket = async (
  socketPath,
  route,
  headers,
  body
) => {
  return new Promise(async (resolve, reject) => {
    try {
      let options = {
        method: "POST",
        socketPath: socketPath,
        path: route,
        headers: headers,
      };

      let callback = function (response) {
        var str = "";
        response.on("data", function (chunk) {
          str += chunk;
        });

        response.on("end", function () {
          return resolve({ code: response.statusCode, message: str });
        });

        response.on("error", function (err) {
          return reject(err);
        });
      };

      //Creating request
      let request = http.request(options, callback);

      //in case request throws an error
      request.on("error", function (err) {
        return reject(err);
      });

      request.end(body);
    } catch (err) {
      return reject(err);
    }
  });
};
