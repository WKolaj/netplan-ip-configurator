//mocking child_process exec
const child_proccess = require("child_process");
const mockExec = jest.fn();
child_proccess.exec = (command, callback) => {
  mockExec(command);
  callback();
};

const config = require("config");
const path = require("path");
const appAuthToken = config.get("appAuthToken");
const socketDirPath = config.get("socketDirPath");
const socketFileName = config.get("socketFileName");
const socketFilePath = path.join(socketDirPath, socketFileName);
const netplanDirPath = config.get("netplanDirPath");
const netplanFileName = config.get("netplanFileName");
const netplanFilePath = path.join(netplanDirPath, netplanFileName);
const {
  clearDirectoryAsync,
  snooze,
  writeFileAsync,
  convertJSONToYaml,
} = require("../../utilities/utilities");
const {
  sendHTTPPostToSocket,
  sendHTTPGetToSocket,
  sendHTTPPutToSocket,
} = require("../utilities/testUtilities");
const { hasUncaughtExceptionCaptureCallback } = require("process");
const { iteratee } = require("lodash");

describe("Inter Process Communication", () => {
  let initialNetplanFileContentJSON;
  let initialNetplanFileContent;
  let createInitialNetplanFile;

  beforeEach(async () => {
    //Clear fake netplan dir
    await clearDirectoryAsync(netplanDirPath);

    createInitialNetplanFile = true;

    initialNetplanFileContentJSON = {
      network: {
        version: 2,
        ethernets: {
          eth1: {
            dhcp4: true,
            optional: true,
          },
          eth2: {
            addresses: ["10.10.10.2/24"],
            gateway4: "10.10.10.1",
            nameservers: { addresses: ["10.10.10.1", "1.1.1.1"] },
            optional: false,
          },
        },
      },
    };
  });

  afterEach(async () => {
    //Clear fake netplan dir
    await clearDirectoryAsync(netplanDirPath);
  });

  const initApp = async () => {
    //Creating initial netplan file
    if (createInitialNetplanFile) {
      initialNetplanFileContent = convertJSONToYaml(
        initialNetplanFileContentJSON
      );
      await writeFileAsync(netplanFilePath, initialNetplanFileContent, "utf8");
    }

    //Starting the app
    await require("../../server");
  };

  describe("HTTP GET", () => {
    let exec = async () => {
      await initApp();

      return sendHTTPGetToSocket(socketFilePath, "/", {
        "x-auth-token": appAuthToken,
      });
    };

    it("should return actual netplan interfaces configuration", async () => {
      let result = await exec();

      expect(result).toBeDefined();

      expect(JSON.parse(result)).toEqual([
        { name: "eth1", dhcp: true, optional: true },
        {
          name: "eth2",
          dhcp: false,
          optional: false,
          ipAddress: "10.10.10.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.10.1",
          dns: ["10.10.10.1", "1.1.1.1"],
        },
      ]);
    });

    it("should return actual netplan interfaces configuration - if netplan file does not exists", async () => {
      createInitialNetplanFile = false;

      let result = await exec();

      expect(result).toBeDefined();

      expect(JSON.parse(result)).toEqual([]);
    });

    it("should return actual netplan interfaces configuration - if netplan interfaces do not exist", async () => {
      initialNetplanFileContentJSON.network.ethernets = {};

      let result = await exec();

      expect(result).toBeDefined();

      expect(JSON.parse(result)).toEqual([]);
    });
  });
});
