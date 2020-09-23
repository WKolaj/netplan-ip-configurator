const net = require("net");
const http = require("http");

module.exports.writeDataToStreamAndWaitForEnd = async (message, stream) => {
  return new Promise(async (res, rej) => {
    try {
      await stream.write(message);
      await stream.end(() => {
        return res();
      });
    } catch (err) {
      return rej(err);
    }
  });
};

module.exports.sendDataToSocket = async (socketPath, message) => {
  var stream = net.connect(socketPath);

  await module.exports.writeDataToStreamAndWaitForEnd(message, stream);
};

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
          return resolve(str);
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
          return resolve(str);
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

module.exports.sendHTTPPutToSocket = async (
  socketPath,
  route,
  headers,
  body
) => {
  return new Promise(async (resolve, reject) => {
    try {
      let options = {
        method: "PUT",
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
          return resolve(str);
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
