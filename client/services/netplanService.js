const config = require("config");
const {
  sendHTTPGetToSocket,
  sendHTTPPostToSocket,
} = require("../utilities/utilities");

let netplanIpSocketPath = null;
let netplanIpAuthToken = null;

module.exports.init = async (socketPath, authToken) => {
  netplanIpSocketPath = socketPath;
  netplanIpAuthToken = authToken;
};

const convertInterfacesPayloadToObject = (interfacesPayload) => {
  let objectToReturn = {};

  for (let inter of interfacesPayload) {
    objectToReturn[inter.name] = inter;
  }

  return objectToReturn;
};

const convertInterfacesObjectToPayload = (interfacesPayload) => {
  return Object.values(interfacesPayload);
};

module.exports.getInterfaces = async () => {
  try {
    //return null if not initialized
    if (!netplanIpSocketPath || !netplanIpAuthToken) return null;

    let response = await sendHTTPGetToSocket(netplanIpSocketPath, "/", {
      "x-auth-token": netplanIpAuthToken,
    });

    if (response.code !== 200) {
      //Invalid response code - return null
      return null;
    }

    let interfacesPayload = JSON.parse(response.message);

    return convertInterfacesPayloadToObject(interfacesPayload);
  } catch (err) {
    //Error during communication - return null
    return null;
  }
};

module.exports.setInterfaces = async (interfacesObject) => {
  try {
    //return null if not initialized
    if (!netplanIpSocketPath || !netplanIpAuthToken) return null;

    let interfacesPayload = convertInterfacesObjectToPayload(interfacesObject);

    let response = await sendHTTPPostToSocket(
      netplanIpSocketPath,
      "/",
      {
        "x-auth-token": netplanIpAuthToken,
        "content-type": "application/json",
      },
      JSON.stringify(interfacesPayload)
    );

    if (response.code !== 200) {
      //Invalid response code - return null
      return null;
    }

    let responseInterfacesPayload = JSON.parse(response.message);

    return convertInterfacesPayloadToObject(responseInterfacesPayload);
  } catch (err) {
    //Error during communication - return null
    return null;
  }
};

module.exports.getInterface = async (interfaceName) => {
  try {
    //return null if not initialized
    if (!netplanIpSocketPath || !netplanIpAuthToken) return null;

    let interfacesObject = await module.exports.getInterfaces();

    if (interfacesObject === null) return null;
    if (!interfacesObject[interfaceName]) return null;

    return interfacesObject[interfaceName];
  } catch (err) {
    //Error during communication - return null
    return null;
  }
};

module.exports.setInterface = async (interfaceName, interfaceObject) => {
  try {
    //return null if not initialized
    if (!netplanIpSocketPath || !netplanIpAuthToken) return null;

    let interfacesObject = await module.exports.getInterfaces();
    if (interfacesObject === null) return null;

    interfacesObject[interfaceName] = interfaceObject;

    let response = await module.exports.setInterfaces(interfacesObject);

    if (response === null) return null;

    return response[interfaceName];
  } catch (err) {
    //Error during communication - return null
    return null;
  }
};
