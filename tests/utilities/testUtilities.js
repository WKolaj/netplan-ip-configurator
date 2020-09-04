const net = require("net");

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
