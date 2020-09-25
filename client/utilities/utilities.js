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

      http.request(options, callback).end();
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

      http.request(options, callback).end(body);
    } catch (err) {
      return reject(err);
    }
  });
};
