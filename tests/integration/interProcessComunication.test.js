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
  readFileAsync,
  convertYamlToJSON,
} = require("../../utilities/utilities");
const {
  sendHTTPPostToSocket,
  sendHTTPGetToSocket,
  sendHTTPPutToSocket,
} = require("../utilities/testUtilities");
const netplanService = require("../../services/netplanService");
const { update } = require("lodash");

describe("Inter Process Communication", () => {
  let initialNetplanFileContentJSON;
  let initialNetplanFileContent;
  let createInitialNetplanFile;

  beforeEach(async () => {
    jest.clearAllMocks();

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
    jest.clearAllMocks();

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
    let headers;

    beforeEach(() => {
      headers = {
        "x-auth-token": appAuthToken,
      };
    });

    let exec = async () => {
      await initApp();

      return sendHTTPGetToSocket(socketFilePath, "/", headers);
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

    it("should return actual netplan interfaces configuration - if netplan file does not exist", async () => {
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

    it("should return actual netplan interfaces configuration - if netplan file is empty", async () => {
      initialNetplanFileContentJSON = {};

      let result = await exec();

      expect(result).toBeDefined();

      expect(JSON.parse(result)).toEqual([]);
    });

    it("should return actual netplan interfaces configuration - if netplan interfaces had been updated", async () => {
      await exec();

      await netplanService.changeSettings({
        interfaces: [
          {
            name: "eth2",
            dhcp: true,
            optional: true,
          },
          {
            name: "eth3",
            dhcp: true,
            optional: false,
          },
          {
            name: "eth4",
            dhcp: false,
            optional: true,
            ipAddress: "10.10.10.2",
            subnetMask: "255.255.255.0",
            gateway: "10.10.10.1",
            dns: ["10.10.10.1", "1.1.1.1"],
          },
        ],
      });

      let result = await sendHTTPGetToSocket(socketFilePath, "/", {
        "x-auth-token": appAuthToken,
      });

      expect(result).toBeDefined();

      expect(JSON.parse(result)).toEqual([
        {
          name: "eth2",
          dhcp: true,
          optional: true,
        },
        {
          name: "eth3",
          dhcp: true,
          optional: false,
        },
        {
          name: "eth4",
          dhcp: false,
          optional: true,
          ipAddress: "10.10.10.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.10.1",
          dns: ["10.10.10.1", "1.1.1.1"],
        },
      ]);
    });

    it("should not return actual netplan interfaces configuration - if token was not added in headers", async () => {
      headers = {};

      let result = await exec();

      expect(result).toEqual("Access forbidden.");
    });

    it("should not return actual netplan interfaces configuration - if token is null in headers", async () => {
      headers = { "x-auth-token": null };

      let result = await exec();

      expect(result).toEqual("Access forbidden.");
    });

    it("should not return actual netplan interfaces configuration - if token is not a valid string", async () => {
      headers = { "x-auth-token": 1234 };

      let result = await exec();

      expect(result).toEqual("Access forbidden.");
    });

    it("should not return actual netplan interfaces configuration - if token is invalid", async () => {
      headers = { "x-auth-token": "fakeToken" };

      let result = await exec();

      expect(result).toEqual("Access forbidden.");
    });
  });

  describe("HTTP POST", () => {
    let headers;
    let initialPayload;
    let updatePayload;

    beforeEach(() => {
      initialPayload = null;
      updatePayload = [
        {
          name: "eth2",
          dhcp: true,
          optional: true,
        },
        {
          name: "eth3",
          dhcp: true,
          optional: false,
        },
        {
          name: "eth4",
          dhcp: false,
          optional: true,
          ipAddress: "10.10.10.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.10.1",
          dns: ["10.10.10.1", "1.1.1.1"],
        },
      ];

      headers = {
        "x-auth-token": appAuthToken,
        "content-type": "application/json",
      };
    });

    let exec = async () => {
      await initApp();

      initialPayload = await netplanService.getSettings();

      return sendHTTPPostToSocket(
        socketFilePath,
        "/",
        headers,
        JSON.stringify(updatePayload)
      );
    };

    it("should update and return actual netplan interfaces configuration", async () => {
      let result = await exec();

      //Checking result
      expect(result).toBeDefined();
      expect(JSON.parse(result)).toEqual(updatePayload);

      //Checking if netplan content has been updated;
      let netplanContent = await netplanService.getSettings();
      let expectedNetplanContent = {
        fileName: netplanFileName,
        dirPath: netplanDirPath,
        interfaces: [
          {
            name: "eth2",
            dhcp: true,
            optional: true,
          },
          {
            name: "eth3",
            dhcp: true,
            optional: false,
          },
          {
            name: "eth4",
            dhcp: false,
            optional: true,
            ipAddress: "10.10.10.2",
            subnetMask: "255.255.255.0",
            gateway: "10.10.10.1",
            dns: ["10.10.10.1", "1.1.1.1"],
          },
        ],
      };

      expect(netplanContent).toEqual(expectedNetplanContent);

      //Checking if netplan file has been updated properly
      let netplanFileContent = await readFileAsync(netplanFilePath, "utf8");
      let netplanFileContentJSON = convertYamlToJSON(netplanFileContent);

      let expectedFileContent = {
        network: {
          version: 2,
          ethernets: {
            eth2: {
              dhcp4: true,
              optional: true,
            },
            eth3: {
              dhcp4: true,
              optional: false,
            },
            eth4: {
              dhcp4: false,
              optional: true,
              addresses: ["10.10.10.2/24"],
              gateway4: "10.10.10.1",
              nameservers: { addresses: ["10.10.10.1", "1.1.1.1"] },
            },
          },
        },
      };

      expect(netplanFileContentJSON).toEqual(expectedFileContent);

      //checking if netplan command was invoked
      expect(mockExec).toHaveBeenCalledTimes(1);

      expect(mockExec.mock.calls[0][0]).toEqual("testApplyCommand");
    });

    it("should update and return actual netplan interfaces configuration - if netplan file does not exist", async () => {
      createInitialNetplanFile = false;

      let result = await exec();

      //Checking result
      expect(result).toBeDefined();
      expect(JSON.parse(result)).toEqual(updatePayload);

      //Checking if netplan content has been updated;
      let netplanContent = await netplanService.getSettings();
      let expectedNetplanContent = {
        fileName: netplanFileName,
        dirPath: netplanDirPath,
        interfaces: [
          {
            name: "eth2",
            dhcp: true,
            optional: true,
          },
          {
            name: "eth3",
            dhcp: true,
            optional: false,
          },
          {
            name: "eth4",
            dhcp: false,
            optional: true,
            ipAddress: "10.10.10.2",
            subnetMask: "255.255.255.0",
            gateway: "10.10.10.1",
            dns: ["10.10.10.1", "1.1.1.1"],
          },
        ],
      };

      expect(netplanContent).toEqual(expectedNetplanContent);

      //Checking if netplan file has been updated properly
      let netplanFileContent = await readFileAsync(netplanFilePath, "utf8");
      let netplanFileContentJSON = convertYamlToJSON(netplanFileContent);

      let expectedFileContent = {
        network: {
          version: 2,
          ethernets: {
            eth2: {
              dhcp4: true,
              optional: true,
            },
            eth3: {
              dhcp4: true,
              optional: false,
            },
            eth4: {
              dhcp4: false,
              optional: true,
              addresses: ["10.10.10.2/24"],
              gateway4: "10.10.10.1",
              nameservers: { addresses: ["10.10.10.1", "1.1.1.1"] },
            },
          },
        },
      };

      expect(netplanFileContentJSON).toEqual(expectedFileContent);

      //checking if netplan command was invoked
      expect(mockExec).toHaveBeenCalledTimes(1);

      expect(mockExec.mock.calls[0][0]).toEqual("testApplyCommand");
    });

    it("should update and return actual netplan interfaces configuration - if netplan interfaces do not exist", async () => {
      initialNetplanFileContentJSON.network.ethernets = {};

      let result = await exec();

      //Checking result
      expect(result).toBeDefined();
      expect(JSON.parse(result)).toEqual(updatePayload);

      //Checking if netplan content has been updated;
      let netplanContent = await netplanService.getSettings();
      let expectedNetplanContent = {
        fileName: netplanFileName,
        dirPath: netplanDirPath,
        interfaces: [
          {
            name: "eth2",
            dhcp: true,
            optional: true,
          },
          {
            name: "eth3",
            dhcp: true,
            optional: false,
          },
          {
            name: "eth4",
            dhcp: false,
            optional: true,
            ipAddress: "10.10.10.2",
            subnetMask: "255.255.255.0",
            gateway: "10.10.10.1",
            dns: ["10.10.10.1", "1.1.1.1"],
          },
        ],
      };

      expect(netplanContent).toEqual(expectedNetplanContent);

      //Checking if netplan file has been updated properly
      let netplanFileContent = await readFileAsync(netplanFilePath, "utf8");
      let netplanFileContentJSON = convertYamlToJSON(netplanFileContent);

      let expectedFileContent = {
        network: {
          version: 2,
          ethernets: {
            eth2: {
              dhcp4: true,
              optional: true,
            },
            eth3: {
              dhcp4: true,
              optional: false,
            },
            eth4: {
              dhcp4: false,
              optional: true,
              addresses: ["10.10.10.2/24"],
              gateway4: "10.10.10.1",
              nameservers: { addresses: ["10.10.10.1", "1.1.1.1"] },
            },
          },
        },
      };

      expect(netplanFileContentJSON).toEqual(expectedFileContent);

      //checking if netplan command was invoked
      expect(mockExec).toHaveBeenCalledTimes(1);

      expect(mockExec.mock.calls[0][0]).toEqual("testApplyCommand");
    });

    it("should update and return actual netplan interfaces configuration - if netplan file is empty", async () => {
      initialNetplanFileContentJSON = {};

      let result = await exec();

      //Checking result
      expect(result).toBeDefined();
      expect(JSON.parse(result)).toEqual(updatePayload);

      //Checking if netplan content has been updated;
      let netplanContent = await netplanService.getSettings();
      let expectedNetplanContent = {
        fileName: netplanFileName,
        dirPath: netplanDirPath,
        interfaces: [
          {
            name: "eth2",
            dhcp: true,
            optional: true,
          },
          {
            name: "eth3",
            dhcp: true,
            optional: false,
          },
          {
            name: "eth4",
            dhcp: false,
            optional: true,
            ipAddress: "10.10.10.2",
            subnetMask: "255.255.255.0",
            gateway: "10.10.10.1",
            dns: ["10.10.10.1", "1.1.1.1"],
          },
        ],
      };

      expect(netplanContent).toEqual(expectedNetplanContent);

      //Checking if netplan file has been updated properly
      let netplanFileContent = await readFileAsync(netplanFilePath, "utf8");
      let netplanFileContentJSON = convertYamlToJSON(netplanFileContent);

      let expectedFileContent = {
        network: {
          version: 2,
          ethernets: {
            eth2: {
              dhcp4: true,
              optional: true,
            },
            eth3: {
              dhcp4: true,
              optional: false,
            },
            eth4: {
              dhcp4: false,
              optional: true,
              addresses: ["10.10.10.2/24"],
              gateway4: "10.10.10.1",
              nameservers: { addresses: ["10.10.10.1", "1.1.1.1"] },
            },
          },
        },
      };

      expect(netplanFileContentJSON).toEqual(expectedFileContent);

      //checking if netplan command was invoked
      expect(mockExec).toHaveBeenCalledTimes(1);

      expect(mockExec.mock.calls[0][0]).toEqual("testApplyCommand");
    });

    it("should update and return actual netplan interfaces configuration - if netplan interfaces had been previously updated", async () => {
      await exec();

      let updatePayload2 = [
        {
          name: "eth7",
          dhcp: true,
          optional: true,
        },
        {
          name: "eth8",
          dhcp: true,
          optional: true,
        },
        {
          name: "eth9",
          dhcp: false,
          optional: false,
          ipAddress: "10.10.10.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.10.1",
          dns: ["10.10.10.1", "1.1.1.1"],
        },
      ];

      let result = await sendHTTPPostToSocket(
        socketFilePath,
        "/",
        headers,
        JSON.stringify(updatePayload2)
      );

      //Checking result
      expect(result).toBeDefined();
      expect(JSON.parse(result)).toEqual(updatePayload2);

      //Checking if netplan content has been updated;
      let netplanContent = await netplanService.getSettings();
      let expectedNetplanContent = {
        fileName: netplanFileName,
        dirPath: netplanDirPath,
        interfaces: [
          {
            name: "eth7",
            dhcp: true,
            optional: true,
          },
          {
            name: "eth8",
            dhcp: true,
            optional: true,
          },
          {
            name: "eth9",
            dhcp: false,
            optional: false,
            ipAddress: "10.10.10.2",
            subnetMask: "255.255.255.0",
            gateway: "10.10.10.1",
            dns: ["10.10.10.1", "1.1.1.1"],
          },
        ],
      };

      expect(netplanContent).toEqual(expectedNetplanContent);

      //Checking if netplan file has been updated properly
      let netplanFileContent = await readFileAsync(netplanFilePath, "utf8");
      let netplanFileContentJSON = convertYamlToJSON(netplanFileContent);

      let expectedFileContent = {
        network: {
          version: 2,
          ethernets: {
            eth7: {
              dhcp4: true,
              optional: true,
            },
            eth8: {
              dhcp4: true,
              optional: true,
            },
            eth9: {
              dhcp4: false,
              optional: false,
              addresses: ["10.10.10.2/24"],
              gateway4: "10.10.10.1",
              nameservers: { addresses: ["10.10.10.1", "1.1.1.1"] },
            },
          },
        },
      };

      expect(netplanFileContentJSON).toEqual(expectedFileContent);

      //checking if netplan command was invoked
      expect(mockExec).toHaveBeenCalledTimes(2);

      expect(mockExec.mock.calls[0][0]).toEqual("testApplyCommand");
      expect(mockExec.mock.calls[1][0]).toEqual("testApplyCommand");
    });

    it("should update and return actual netplan interfaces configuration - if interfaces are empty", async () => {
      updatePayload = [];

      let result = await exec();

      //Checking result
      expect(result).toBeDefined();
      expect(JSON.parse(result)).toEqual(updatePayload);

      //Checking if netplan content has been updated;
      let netplanContent = await netplanService.getSettings();
      let expectedNetplanContent = {
        fileName: netplanFileName,
        dirPath: netplanDirPath,
        interfaces: [],
      };

      expect(netplanContent).toEqual(expectedNetplanContent);

      //Checking if netplan file has been updated properly
      let netplanFileContent = await readFileAsync(netplanFilePath, "utf8");
      let netplanFileContentJSON = convertYamlToJSON(netplanFileContent);

      let expectedFileContent = {
        network: {
          version: 2,
          ethernets: {},
        },
      };

      expect(netplanFileContentJSON).toEqual(expectedFileContent);

      //checking if netplan command was invoked
      expect(mockExec).toHaveBeenCalledTimes(1);

      expect(mockExec.mock.calls[0][0]).toEqual("testApplyCommand");
    });

    it("should update and return actual netplan interfaces configuration - if one of interface has dhcp and other static parameters", async () => {
      updatePayload = [
        {
          name: "eth2",
          dhcp: true,
          optional: true,
        },
        {
          name: "eth3",
          dhcp: true,
          optional: false,
        },
        {
          name: "eth4",
          dhcp: true,
          optional: true,
          ipAddress: "10.10.10.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.10.1",
          dns: ["10.10.10.1", "1.1.1.1"],
        },
      ];

      let result = await exec();

      //Checking result
      expect(result).toBeDefined();
      let expectedResult = [
        {
          name: "eth2",
          dhcp: true,
          optional: true,
        },
        {
          name: "eth3",
          dhcp: true,
          optional: false,
        },
        {
          name: "eth4",
          dhcp: true,
          optional: true,
        },
      ];

      expect(JSON.parse(result)).toEqual(expectedResult);

      //Checking if netplan content has been updated;
      let netplanContent = await netplanService.getSettings();
      let expectedNetplanContent = {
        fileName: netplanFileName,
        dirPath: netplanDirPath,
        interfaces: [
          {
            name: "eth2",
            dhcp: true,
            optional: true,
          },
          {
            name: "eth3",
            dhcp: true,
            optional: false,
          },
          {
            name: "eth4",
            dhcp: true,
            optional: true,
          },
        ],
      };

      expect(netplanContent).toEqual(expectedNetplanContent);

      //Checking if netplan file has been updated properly
      let netplanFileContent = await readFileAsync(netplanFilePath, "utf8");
      let netplanFileContentJSON = convertYamlToJSON(netplanFileContent);

      let expectedFileContent = {
        network: {
          version: 2,
          ethernets: {
            eth2: {
              dhcp4: true,
              optional: true,
            },
            eth3: {
              dhcp4: true,
              optional: false,
            },
            eth4: {
              dhcp4: true,
              optional: true,
            },
          },
        },
      };

      expect(netplanFileContentJSON).toEqual(expectedFileContent);

      //checking if netplan command was invoked
      expect(mockExec).toHaveBeenCalledTimes(1);

      expect(mockExec.mock.calls[0][0]).toEqual("testApplyCommand");
    });

    it("should not update and return actual netplan interfaces configuration - if token was not added in headers", async () => {
      headers = {};

      let result = await exec();

      expect(result).toEqual("Access forbidden.");

      //Checking if netplan content has been updated;
      let netplanContent = await netplanService.getSettings();
      expect(netplanContent).toEqual(initialPayload);

      //Checking if netplan file has been updated properly
      let netplanFileContent = await readFileAsync(netplanFilePath, "utf8");
      let netplanFileContentJSON = convertYamlToJSON(netplanFileContent);

      expect(netplanFileContentJSON).toEqual(initialNetplanFileContentJSON);

      //checking if netplan command was invoked
      expect(mockExec).not.toHaveBeenCalled();
    });

    it("should not update and return actual netplan interfaces configuration - if token is null in headers", async () => {
      headers = { "x-auth-token": null };

      let result = await exec();

      expect(result).toEqual("Access forbidden.");

      //Checking if netplan content has been updated;
      let netplanContent = await netplanService.getSettings();
      expect(netplanContent).toEqual(initialPayload);

      //Checking if netplan file has been updated properly
      let netplanFileContent = await readFileAsync(netplanFilePath, "utf8");
      let netplanFileContentJSON = convertYamlToJSON(netplanFileContent);

      expect(netplanFileContentJSON).toEqual(initialNetplanFileContentJSON);

      //checking if netplan command was invoked
      expect(mockExec).not.toHaveBeenCalled();
    });

    it("should not update and return actual netplan interfaces configuration - if token is not a valid string", async () => {
      headers = { "x-auth-token": 1234 };

      let result = await exec();

      expect(result).toEqual("Access forbidden.");

      //Checking if netplan content has been updated;
      let netplanContent = await netplanService.getSettings();
      expect(netplanContent).toEqual(initialPayload);

      //Checking if netplan file has been updated properly
      let netplanFileContent = await readFileAsync(netplanFilePath, "utf8");
      let netplanFileContentJSON = convertYamlToJSON(netplanFileContent);

      expect(netplanFileContentJSON).toEqual(initialNetplanFileContentJSON);

      //checking if netplan command was invoked
      expect(mockExec).not.toHaveBeenCalled();
    });

    it("should not update and return actual netplan interfaces configuration - if token is invalid", async () => {
      headers = { "x-auth-token": "fakeToken" };

      let result = await exec();

      expect(result).toEqual("Access forbidden.");

      //Checking if netplan content has been updated;
      let netplanContent = await netplanService.getSettings();
      expect(netplanContent).toEqual(initialPayload);

      //Checking if netplan file has been updated properly
      let netplanFileContent = await readFileAsync(netplanFilePath, "utf8");
      let netplanFileContentJSON = convertYamlToJSON(netplanFileContent);

      expect(netplanFileContentJSON).toEqual(initialNetplanFileContentJSON);

      //checking if netplan command was invoked
      expect(mockExec).not.toHaveBeenCalled();
    });

    it("should not update and return actual netplan interfaces configuration - if update payload is not defined", async () => {
      updatePayload = undefined;

      let result = await exec();

      expect(result).toEqual("Invalid data format.");

      //Checking if netplan content has been updated;
      let netplanContent = await netplanService.getSettings();
      expect(netplanContent).toEqual(initialPayload);

      //Checking if netplan file has been updated properly
      let netplanFileContent = await readFileAsync(netplanFilePath, "utf8");
      let netplanFileContentJSON = convertYamlToJSON(netplanFileContent);

      expect(netplanFileContentJSON).toEqual(initialNetplanFileContentJSON);

      //checking if netplan command was invoked
      expect(mockExec).not.toHaveBeenCalled();
    });

    it("should not update and return actual netplan interfaces configuration - if update payload is null", async () => {
      updatePayload = null;

      let result = await exec();

      expect(result).toEqual('"Invalid data format"');

      //Checking if netplan content has been updated;
      let netplanContent = await netplanService.getSettings();
      expect(netplanContent).toEqual(initialPayload);

      //Checking if netplan file has been updated properly
      let netplanFileContent = await readFileAsync(netplanFilePath, "utf8");
      let netplanFileContentJSON = convertYamlToJSON(netplanFileContent);

      expect(netplanFileContentJSON).toEqual(initialNetplanFileContentJSON);

      //checking if netplan command was invoked
      expect(mockExec).not.toHaveBeenCalled();
    });

    it("should not update and return actual netplan interfaces configuration - if update payload is not a JSON - string", async () => {
      updatePayload = "fake";

      let result = await exec();

      expect(result).toEqual('"Invalid data format"');

      //Checking if netplan content has been updated;
      let netplanContent = await netplanService.getSettings();
      expect(netplanContent).toEqual(initialPayload);

      //Checking if netplan file has been updated properly
      let netplanFileContent = await readFileAsync(netplanFilePath, "utf8");
      let netplanFileContentJSON = convertYamlToJSON(netplanFileContent);

      expect(netplanFileContentJSON).toEqual(initialNetplanFileContentJSON);

      //checking if netplan command was invoked
      expect(mockExec).not.toHaveBeenCalled();
    });

    it("should update and return actual netplan interfaces configuration - if there is only one interface", async () => {
      updatePayload = [
        {
          name: "eth4",
          dhcp: false,
          optional: true,
          ipAddress: "10.10.10.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.10.1",
          dns: ["10.10.10.1", "1.1.1.1"],
        },
      ];

      let result = await exec();

      //Checking result
      expect(result).toBeDefined();
      expect(JSON.parse(result)).toEqual(updatePayload);

      //Checking if netplan content has been updated;
      let netplanContent = await netplanService.getSettings();
      let expectedNetplanContent = {
        fileName: netplanFileName,
        dirPath: netplanDirPath,
        interfaces: [
          {
            name: "eth4",
            dhcp: false,
            optional: true,
            ipAddress: "10.10.10.2",
            subnetMask: "255.255.255.0",
            gateway: "10.10.10.1",
            dns: ["10.10.10.1", "1.1.1.1"],
          },
        ],
      };

      expect(netplanContent).toEqual(expectedNetplanContent);

      //Checking if netplan file has been updated properly
      let netplanFileContent = await readFileAsync(netplanFilePath, "utf8");
      let netplanFileContentJSON = convertYamlToJSON(netplanFileContent);

      let expectedFileContent = {
        network: {
          version: 2,
          ethernets: {
            eth4: {
              dhcp4: false,
              optional: true,
              addresses: ["10.10.10.2/24"],
              gateway4: "10.10.10.1",
              nameservers: { addresses: ["10.10.10.1", "1.1.1.1"] },
            },
          },
        },
      };

      expect(netplanFileContentJSON).toEqual(expectedFileContent);

      //checking if netplan command was invoked
      expect(mockExec).toHaveBeenCalledTimes(1);

      expect(mockExec.mock.calls[0][0]).toEqual("testApplyCommand");
    });

    it("should update and return actual netplan interfaces configuration - if interface has dhcp to true and other static parameters", async () => {
      updatePayload = [
        {
          name: "eth4",
          dhcp: true,
          optional: true,
          ipAddress: "10.10.10.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.10.1",
          dns: ["10.10.10.1", "1.1.1.1"],
        },
      ];

      let result = await exec();

      //Checking result
      expect(result).toBeDefined();
      let expectedPayload = [
        {
          name: "eth4",
          dhcp: true,
          optional: true,
        },
      ];
      expect(JSON.parse(result)).toEqual(expectedPayload);

      //Checking if netplan content has been updated;
      let netplanContent = await netplanService.getSettings();
      let expectedNetplanContent = {
        fileName: netplanFileName,
        dirPath: netplanDirPath,
        interfaces: [
          {
            name: "eth4",
            dhcp: true,
            optional: true,
          },
        ],
      };

      expect(netplanContent).toEqual(expectedNetplanContent);

      //Checking if netplan file has been updated properly
      let netplanFileContent = await readFileAsync(netplanFilePath, "utf8");
      let netplanFileContentJSON = convertYamlToJSON(netplanFileContent);

      let expectedFileContent = {
        network: {
          version: 2,
          ethernets: {
            eth4: {
              dhcp4: true,
              optional: true,
            },
          },
        },
      };

      expect(netplanFileContentJSON).toEqual(expectedFileContent);

      //checking if netplan command was invoked
      expect(mockExec).toHaveBeenCalledTimes(1);

      expect(mockExec.mock.calls[0][0]).toEqual("testApplyCommand");
    });

    it("should not update and return actual netplan interfaces configuration - if interface does not have name", async () => {
      updatePayload = [
        {
          dhcp: false,
          optional: true,
          ipAddress: "10.10.10.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.10.1",
          dns: ["10.10.10.1", "1.1.1.1"],
        },
      ];

      let result = await exec();

      expect(result).toEqual('"Invalid data format"');

      //Checking if netplan content has been updated;
      let netplanContent = await netplanService.getSettings();
      expect(netplanContent).toEqual(initialPayload);

      //Checking if netplan file has been updated properly
      let netplanFileContent = await readFileAsync(netplanFilePath, "utf8");
      let netplanFileContentJSON = convertYamlToJSON(netplanFileContent);

      expect(netplanFileContentJSON).toEqual(initialNetplanFileContentJSON);

      //checking if netplan command was invoked
      expect(mockExec).not.toHaveBeenCalled();
    });

    it("should not update and return actual netplan interfaces configuration - if interface has null name", async () => {
      updatePayload = [
        {
          name: null,
          dhcp: false,
          optional: true,
          ipAddress: "10.10.10.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.10.1",
          dns: ["10.10.10.1", "1.1.1.1"],
        },
      ];

      let result = await exec();

      expect(result).toEqual('"Invalid data format"');

      //Checking if netplan content has been updated;
      let netplanContent = await netplanService.getSettings();
      expect(netplanContent).toEqual(initialPayload);

      //Checking if netplan file has been updated properly
      let netplanFileContent = await readFileAsync(netplanFilePath, "utf8");
      let netplanFileContentJSON = convertYamlToJSON(netplanFileContent);

      expect(netplanFileContentJSON).toEqual(initialNetplanFileContentJSON);

      //checking if netplan command was invoked
      expect(mockExec).not.toHaveBeenCalled();
    });

    it("should not update and return actual netplan interfaces configuration - if interface has empty name", async () => {
      updatePayload = [
        {
          name: "",
          dhcp: false,
          optional: true,
          ipAddress: "10.10.10.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.10.1",
          dns: ["10.10.10.1", "1.1.1.1"],
        },
      ];

      let result = await exec();

      expect(result).toEqual('"Invalid data format"');

      //Checking if netplan content has been updated;
      let netplanContent = await netplanService.getSettings();
      expect(netplanContent).toEqual(initialPayload);

      //Checking if netplan file has been updated properly
      let netplanFileContent = await readFileAsync(netplanFilePath, "utf8");
      let netplanFileContentJSON = convertYamlToJSON(netplanFileContent);

      expect(netplanFileContentJSON).toEqual(initialNetplanFileContentJSON);

      //checking if netplan command was invoked
      expect(mockExec).not.toHaveBeenCalled();
    });

    it("should not update and return actual netplan interfaces configuration - if interface has non string name", async () => {
      updatePayload = [
        {
          name: 1234,
          dhcp: false,
          optional: true,
          ipAddress: "10.10.10.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.10.1",
          dns: ["10.10.10.1", "1.1.1.1"],
        },
      ];

      let result = await exec();

      expect(result).toEqual('"Invalid data format"');

      //Checking if netplan content has been updated;
      let netplanContent = await netplanService.getSettings();
      expect(netplanContent).toEqual(initialPayload);

      //Checking if netplan file has been updated properly
      let netplanFileContent = await readFileAsync(netplanFilePath, "utf8");
      let netplanFileContentJSON = convertYamlToJSON(netplanFileContent);

      expect(netplanFileContentJSON).toEqual(initialNetplanFileContentJSON);

      //checking if netplan command was invoked
      expect(mockExec).not.toHaveBeenCalled();
    });

    it("should not update and return actual netplan interfaces configuration - if there are interfaces with the same name", async () => {
      updatePayload = [
        {
          name: "eth2",
          dhcp: true,
          optional: true,
        },
        {
          name: "eth3",
          dhcp: true,
          optional: false,
        },
        {
          name: "eth3",
          dhcp: false,
          optional: true,
          ipAddress: "10.10.10.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.10.1",
          dns: ["10.10.10.1", "1.1.1.1"],
        },
      ];

      let result = await exec();

      expect(result).toEqual('"Invalid data format"');

      //Checking if netplan content has been updated;
      let netplanContent = await netplanService.getSettings();
      expect(netplanContent).toEqual(initialPayload);

      //Checking if netplan file has been updated properly
      let netplanFileContent = await readFileAsync(netplanFilePath, "utf8");
      let netplanFileContentJSON = convertYamlToJSON(netplanFileContent);

      expect(netplanFileContentJSON).toEqual(initialNetplanFileContentJSON);

      //checking if netplan command was invoked
      expect(mockExec).not.toHaveBeenCalled();
    });

    it("should not update and return actual netplan interfaces configuration - if interface does not have dhcp", async () => {
      updatePayload = [
        {
          name: "eth4",
          optional: true,
          ipAddress: "10.10.10.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.10.1",
          dns: ["10.10.10.1", "1.1.1.1"],
        },
      ];

      let result = await exec();

      expect(result).toEqual('"Invalid data format"');

      //Checking if netplan content has been updated;
      let netplanContent = await netplanService.getSettings();
      expect(netplanContent).toEqual(initialPayload);

      //Checking if netplan file has been updated properly
      let netplanFileContent = await readFileAsync(netplanFilePath, "utf8");
      let netplanFileContentJSON = convertYamlToJSON(netplanFileContent);

      expect(netplanFileContentJSON).toEqual(initialNetplanFileContentJSON);

      //checking if netplan command was invoked
      expect(mockExec).not.toHaveBeenCalled();
    });

    it("should not update and return actual netplan interfaces configuration - if interface has null dhcp", async () => {
      updatePayload = [
        {
          name: "eth4",
          dhcp: null,
          optional: true,
          ipAddress: "10.10.10.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.10.1",
          dns: ["10.10.10.1", "1.1.1.1"],
        },
      ];

      let result = await exec();

      expect(result).toEqual('"Invalid data format"');

      //Checking if netplan content has been updated;
      let netplanContent = await netplanService.getSettings();
      expect(netplanContent).toEqual(initialPayload);

      //Checking if netplan file has been updated properly
      let netplanFileContent = await readFileAsync(netplanFilePath, "utf8");
      let netplanFileContentJSON = convertYamlToJSON(netplanFileContent);

      expect(netplanFileContentJSON).toEqual(initialNetplanFileContentJSON);

      //checking if netplan command was invoked
      expect(mockExec).not.toHaveBeenCalled();
    });

    it("should not update and return actual netplan interfaces configuration - if interface has non boolean dhcp", async () => {
      updatePayload = [
        {
          name: "eth4",
          dhcp: 1234,
          optional: true,
          ipAddress: "10.10.10.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.10.1",
          dns: ["10.10.10.1", "1.1.1.1"],
        },
      ];

      let result = await exec();

      expect(result).toEqual('"Invalid data format"');

      //Checking if netplan content has been updated;
      let netplanContent = await netplanService.getSettings();
      expect(netplanContent).toEqual(initialPayload);

      //Checking if netplan file has been updated properly
      let netplanFileContent = await readFileAsync(netplanFilePath, "utf8");
      let netplanFileContentJSON = convertYamlToJSON(netplanFileContent);

      expect(netplanFileContentJSON).toEqual(initialNetplanFileContentJSON);

      //checking if netplan command was invoked
      expect(mockExec).not.toHaveBeenCalled();
    });

    it("should not update and return actual netplan interfaces configuration - if interface does not have optional", async () => {
      updatePayload = [
        {
          name: "eth4",
          dhcp: false,
          ipAddress: "10.10.10.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.10.1",
          dns: ["10.10.10.1", "1.1.1.1"],
        },
      ];

      let result = await exec();

      expect(result).toEqual('"Invalid data format"');

      //Checking if netplan content has been updated;
      let netplanContent = await netplanService.getSettings();
      expect(netplanContent).toEqual(initialPayload);

      //Checking if netplan file has been updated properly
      let netplanFileContent = await readFileAsync(netplanFilePath, "utf8");
      let netplanFileContentJSON = convertYamlToJSON(netplanFileContent);

      expect(netplanFileContentJSON).toEqual(initialNetplanFileContentJSON);

      //checking if netplan command was invoked
      expect(mockExec).not.toHaveBeenCalled();
    });

    it("should not update and return actual netplan interfaces configuration - if interface has null optional", async () => {
      updatePayload = [
        {
          name: "eth4",
          dhcp: false,
          optional: null,
          ipAddress: "10.10.10.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.10.1",
          dns: ["10.10.10.1", "1.1.1.1"],
        },
      ];

      let result = await exec();

      expect(result).toEqual('"Invalid data format"');

      //Checking if netplan content has been updated;
      let netplanContent = await netplanService.getSettings();
      expect(netplanContent).toEqual(initialPayload);

      //Checking if netplan file has been updated properly
      let netplanFileContent = await readFileAsync(netplanFilePath, "utf8");
      let netplanFileContentJSON = convertYamlToJSON(netplanFileContent);

      expect(netplanFileContentJSON).toEqual(initialNetplanFileContentJSON);

      //checking if netplan command was invoked
      expect(mockExec).not.toHaveBeenCalled();
    });

    it("should not update and return actual netplan interfaces configuration - if interface has non boolean optional", async () => {
      updatePayload = [
        {
          name: "eth4",
          dhcp: false,
          optional: 1234,
          ipAddress: "10.10.10.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.10.1",
          dns: ["10.10.10.1", "1.1.1.1"],
        },
      ];

      let result = await exec();

      expect(result).toEqual('"Invalid data format"');

      //Checking if netplan content has been updated;
      let netplanContent = await netplanService.getSettings();
      expect(netplanContent).toEqual(initialPayload);

      //Checking if netplan file has been updated properly
      let netplanFileContent = await readFileAsync(netplanFilePath, "utf8");
      let netplanFileContentJSON = convertYamlToJSON(netplanFileContent);

      expect(netplanFileContentJSON).toEqual(initialNetplanFileContentJSON);

      //checking if netplan command was invoked
      expect(mockExec).not.toHaveBeenCalled();
    });

    it("should not update and return actual netplan interfaces configuration - if interface has dhcp set to false and no ipAddress", async () => {
      updatePayload = [
        {
          name: "eth4",
          dhcp: false,
          optional: true,
          subnetMask: "255.255.255.0",
          gateway: "10.10.10.1",
          dns: ["10.10.10.1", "1.1.1.1"],
        },
      ];

      let result = await exec();

      expect(result).toEqual('"Invalid data format"');

      //Checking if netplan content has been updated;
      let netplanContent = await netplanService.getSettings();
      expect(netplanContent).toEqual(initialPayload);

      //Checking if netplan file has been updated properly
      let netplanFileContent = await readFileAsync(netplanFilePath, "utf8");
      let netplanFileContentJSON = convertYamlToJSON(netplanFileContent);

      expect(netplanFileContentJSON).toEqual(initialNetplanFileContentJSON);

      //checking if netplan command was invoked
      expect(mockExec).not.toHaveBeenCalled();
    });

    it("should not update and return actual netplan interfaces configuration - if interface has dhcp set to false and ipAddress as null", async () => {
      updatePayload = [
        {
          name: "eth4",
          dhcp: false,
          optional: true,
          ipAddress: null,
          subnetMask: "255.255.255.0",
          gateway: "10.10.10.1",
          dns: ["10.10.10.1", "1.1.1.1"],
        },
      ];

      let result = await exec();

      expect(result).toEqual('"Invalid data format"');

      //Checking if netplan content has been updated;
      let netplanContent = await netplanService.getSettings();
      expect(netplanContent).toEqual(initialPayload);

      //Checking if netplan file has been updated properly
      let netplanFileContent = await readFileAsync(netplanFilePath, "utf8");
      let netplanFileContentJSON = convertYamlToJSON(netplanFileContent);

      expect(netplanFileContentJSON).toEqual(initialNetplanFileContentJSON);

      //checking if netplan command was invoked
      expect(mockExec).not.toHaveBeenCalled();
    });

    it("should not update and return actual netplan interfaces configuration - if interface has dhcp set to false and ipAddress as non string", async () => {
      updatePayload = [
        {
          name: "eth4",
          dhcp: false,
          optional: true,
          ipAddress: 1234,
          subnetMask: "255.255.255.0",
          gateway: "10.10.10.1",
          dns: ["10.10.10.1", "1.1.1.1"],
        },
      ];

      let result = await exec();

      expect(result).toEqual('"Invalid data format"');

      //Checking if netplan content has been updated;
      let netplanContent = await netplanService.getSettings();
      expect(netplanContent).toEqual(initialPayload);

      //Checking if netplan file has been updated properly
      let netplanFileContent = await readFileAsync(netplanFilePath, "utf8");
      let netplanFileContentJSON = convertYamlToJSON(netplanFileContent);

      expect(netplanFileContentJSON).toEqual(initialNetplanFileContentJSON);

      //checking if netplan command was invoked
      expect(mockExec).not.toHaveBeenCalled();
    });

    it("should not update and return actual netplan interfaces configuration - if interface has dhcp set to false and ipAddress as invalid string", async () => {
      updatePayload = [
        {
          name: "eth4",
          dhcp: false,
          optional: true,
          ipAddress: "abcd",
          subnetMask: "255.255.255.0",
          gateway: "10.10.10.1",
          dns: ["10.10.10.1", "1.1.1.1"],
        },
      ];

      let result = await exec();

      expect(result).toEqual('"Invalid data format"');

      //Checking if netplan content has been updated;
      let netplanContent = await netplanService.getSettings();
      expect(netplanContent).toEqual(initialPayload);

      //Checking if netplan file has been updated properly
      let netplanFileContent = await readFileAsync(netplanFilePath, "utf8");
      let netplanFileContentJSON = convertYamlToJSON(netplanFileContent);

      expect(netplanFileContentJSON).toEqual(initialNetplanFileContentJSON);

      //checking if netplan command was invoked
      expect(mockExec).not.toHaveBeenCalled();
    });

    it("should not update and return actual netplan interfaces configuration - if interface has dhcp set to false and ipAddress as address with cidr", async () => {
      updatePayload = [
        {
          name: "eth4",
          dhcp: false,
          optional: true,
          ipAddress: "10.10.10.2/24",
          subnetMask: "255.255.255.0",
          gateway: "10.10.10.1",
          dns: ["10.10.10.1", "1.1.1.1"],
        },
      ];

      let result = await exec();

      expect(result).toEqual('"Invalid data format"');

      //Checking if netplan content has been updated;
      let netplanContent = await netplanService.getSettings();
      expect(netplanContent).toEqual(initialPayload);

      //Checking if netplan file has been updated properly
      let netplanFileContent = await readFileAsync(netplanFilePath, "utf8");
      let netplanFileContentJSON = convertYamlToJSON(netplanFileContent);

      expect(netplanFileContentJSON).toEqual(initialNetplanFileContentJSON);

      //checking if netplan command was invoked
      expect(mockExec).not.toHaveBeenCalled();
    });

    it("should not update and return actual netplan interfaces configuration - if interface has dhcp set to false and no gateway", async () => {
      updatePayload = [
        {
          name: "eth4",
          dhcp: false,
          optional: true,
          ipAddress: "10.10.10.2",
          subnetMask: "255.255.255.0",
          dns: ["10.10.10.1", "1.1.1.1"],
        },
      ];

      let result = await exec();

      expect(result).toEqual('"Invalid data format"');

      //Checking if netplan content has been updated;
      let netplanContent = await netplanService.getSettings();
      expect(netplanContent).toEqual(initialPayload);

      //Checking if netplan file has been updated properly
      let netplanFileContent = await readFileAsync(netplanFilePath, "utf8");
      let netplanFileContentJSON = convertYamlToJSON(netplanFileContent);

      expect(netplanFileContentJSON).toEqual(initialNetplanFileContentJSON);

      //checking if netplan command was invoked
      expect(mockExec).not.toHaveBeenCalled();
    });

    it("should not update and return actual netplan interfaces configuration - if interface has dhcp set to false and gateway as null", async () => {
      updatePayload = [
        {
          name: "eth4",
          dhcp: false,
          optional: true,
          ipAddress: "10.10.10.2",
          subnetMask: "255.255.255.0",
          gateway: null,
          dns: ["10.10.10.1", "1.1.1.1"],
        },
      ];

      let result = await exec();

      expect(result).toEqual('"Invalid data format"');

      //Checking if netplan content has been updated;
      let netplanContent = await netplanService.getSettings();
      expect(netplanContent).toEqual(initialPayload);

      //Checking if netplan file has been updated properly
      let netplanFileContent = await readFileAsync(netplanFilePath, "utf8");
      let netplanFileContentJSON = convertYamlToJSON(netplanFileContent);

      expect(netplanFileContentJSON).toEqual(initialNetplanFileContentJSON);

      //checking if netplan command was invoked
      expect(mockExec).not.toHaveBeenCalled();
    });

    it("should not update and return actual netplan interfaces configuration - if interface has dhcp set to false and gateway as non string", async () => {
      updatePayload = [
        {
          name: "eth4",
          dhcp: false,
          optional: true,
          ipAddress: "10.10.10.2",
          subnetMask: "255.255.255.0",
          gateway: 1234,
          dns: ["10.10.10.1", "1.1.1.1"],
        },
      ];

      let result = await exec();

      expect(result).toEqual('"Invalid data format"');

      //Checking if netplan content has been updated;
      let netplanContent = await netplanService.getSettings();
      expect(netplanContent).toEqual(initialPayload);

      //Checking if netplan file has been updated properly
      let netplanFileContent = await readFileAsync(netplanFilePath, "utf8");
      let netplanFileContentJSON = convertYamlToJSON(netplanFileContent);

      expect(netplanFileContentJSON).toEqual(initialNetplanFileContentJSON);

      //checking if netplan command was invoked
      expect(mockExec).not.toHaveBeenCalled();
    });

    it("should not update and return actual netplan interfaces configuration - if interface has dhcp set to false and gateway as invalid string", async () => {
      updatePayload = [
        {
          name: "eth4",
          dhcp: false,
          optional: true,
          ipAddress: "10.10.10.2",
          subnetMask: "255.255.255.0",
          gateway: "abcd",
          dns: ["10.10.10.1", "1.1.1.1"],
        },
      ];

      let result = await exec();

      expect(result).toEqual('"Invalid data format"');

      //Checking if netplan content has been updated;
      let netplanContent = await netplanService.getSettings();
      expect(netplanContent).toEqual(initialPayload);

      //Checking if netplan file has been updated properly
      let netplanFileContent = await readFileAsync(netplanFilePath, "utf8");
      let netplanFileContentJSON = convertYamlToJSON(netplanFileContent);

      expect(netplanFileContentJSON).toEqual(initialNetplanFileContentJSON);

      //checking if netplan command was invoked
      expect(mockExec).not.toHaveBeenCalled();
    });

    it("should not update and return actual netplan interfaces configuration - if interface has dhcp set to false and gateway as address with cidr", async () => {
      updatePayload = [
        {
          name: "eth4",
          dhcp: false,
          optional: true,
          ipAddress: "10.10.10.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.10.1/24",
          dns: ["10.10.10.1", "1.1.1.1"],
        },
      ];

      let result = await exec();

      expect(result).toEqual('"Invalid data format"');

      //Checking if netplan content has been updated;
      let netplanContent = await netplanService.getSettings();
      expect(netplanContent).toEqual(initialPayload);

      //Checking if netplan file has been updated properly
      let netplanFileContent = await readFileAsync(netplanFilePath, "utf8");
      let netplanFileContentJSON = convertYamlToJSON(netplanFileContent);

      expect(netplanFileContentJSON).toEqual(initialNetplanFileContentJSON);

      //checking if netplan command was invoked
      expect(mockExec).not.toHaveBeenCalled();
    });

    it("should not update and return actual netplan interfaces configuration - if interface has dhcp set to false and not subnetMask", async () => {
      updatePayload = [
        {
          name: "eth4",
          dhcp: false,
          optional: true,
          ipAddress: "10.10.10.2",
          gateway: "10.10.10.1",
          dns: ["10.10.10.1", "1.1.1.1"],
        },
      ];

      let result = await exec();

      expect(result).toEqual('"Invalid data format"');

      //Checking if netplan content has been updated;
      let netplanContent = await netplanService.getSettings();
      expect(netplanContent).toEqual(initialPayload);

      //Checking if netplan file has been updated properly
      let netplanFileContent = await readFileAsync(netplanFilePath, "utf8");
      let netplanFileContentJSON = convertYamlToJSON(netplanFileContent);

      expect(netplanFileContentJSON).toEqual(initialNetplanFileContentJSON);

      //checking if netplan command was invoked
      expect(mockExec).not.toHaveBeenCalled();
    });

    it("should not update and return actual netplan interfaces configuration - if interface has dhcp set to false and subnetMask as null", async () => {
      updatePayload = [
        {
          name: "eth4",
          dhcp: false,
          optional: true,
          ipAddress: "10.10.10.2",
          subnetMask: null,
          gateway: "10.10.10.1",
          dns: ["10.10.10.1", "1.1.1.1"],
        },
      ];

      let result = await exec();

      expect(result).toEqual('"Invalid data format"');

      //Checking if netplan content has been updated;
      let netplanContent = await netplanService.getSettings();
      expect(netplanContent).toEqual(initialPayload);

      //Checking if netplan file has been updated properly
      let netplanFileContent = await readFileAsync(netplanFilePath, "utf8");
      let netplanFileContentJSON = convertYamlToJSON(netplanFileContent);

      expect(netplanFileContentJSON).toEqual(initialNetplanFileContentJSON);

      //checking if netplan command was invoked
      expect(mockExec).not.toHaveBeenCalled();
    });

    it("should not update and return actual netplan interfaces configuration - if interface has dhcp set to false and subnetMask as non string", async () => {
      updatePayload = [
        {
          name: "eth4",
          dhcp: false,
          optional: true,
          ipAddress: "10.10.10.2",
          subnetMask: 1234,
          gateway: "10.10.10.1",
          dns: ["10.10.10.1", "1.1.1.1"],
        },
      ];

      let result = await exec();

      expect(result).toEqual('"Invalid data format"');

      //Checking if netplan content has been updated;
      let netplanContent = await netplanService.getSettings();
      expect(netplanContent).toEqual(initialPayload);

      //Checking if netplan file has been updated properly
      let netplanFileContent = await readFileAsync(netplanFilePath, "utf8");
      let netplanFileContentJSON = convertYamlToJSON(netplanFileContent);

      expect(netplanFileContentJSON).toEqual(initialNetplanFileContentJSON);

      //checking if netplan command was invoked
      expect(mockExec).not.toHaveBeenCalled();
    });

    it("should not update and return actual netplan interfaces configuration - if interface has dhcp set to false and subnetMask as invalid string", async () => {
      updatePayload = [
        {
          name: "eth4",
          dhcp: false,
          optional: true,
          ipAddress: "10.10.10.2",
          subnetMask: "abcd",
          gateway: "10.10.10.1",
          dns: ["10.10.10.1", "1.1.1.1"],
        },
      ];

      let result = await exec();

      expect(result).toEqual('"Invalid data format"');

      //Checking if netplan content has been updated;
      let netplanContent = await netplanService.getSettings();
      expect(netplanContent).toEqual(initialPayload);

      //Checking if netplan file has been updated properly
      let netplanFileContent = await readFileAsync(netplanFilePath, "utf8");
      let netplanFileContentJSON = convertYamlToJSON(netplanFileContent);

      expect(netplanFileContentJSON).toEqual(initialNetplanFileContentJSON);

      //checking if netplan command was invoked
      expect(mockExec).not.toHaveBeenCalled();
    });

    it("should not update and return actual netplan interfaces configuration - if interface has dhcp set to false and subnetMask as address with cidr", async () => {
      updatePayload = [
        {
          name: "eth4",
          dhcp: false,
          optional: true,
          ipAddress: "10.10.10.2",
          subnetMask: "255.255.255.0/24",
          gateway: "10.10.10.1",
          dns: ["10.10.10.1", "1.1.1.1"],
        },
      ];

      let result = await exec();

      expect(result).toEqual('"Invalid data format"');

      //Checking if netplan content has been updated;
      let netplanContent = await netplanService.getSettings();
      expect(netplanContent).toEqual(initialPayload);

      //Checking if netplan file has been updated properly
      let netplanFileContent = await readFileAsync(netplanFilePath, "utf8");
      let netplanFileContentJSON = convertYamlToJSON(netplanFileContent);

      expect(netplanFileContentJSON).toEqual(initialNetplanFileContentJSON);

      //checking if netplan command was invoked
      expect(mockExec).not.toHaveBeenCalled();
    });

    it("should update and return actual netplan interfaces configuration - if dhcp is set to false and dns is empty", async () => {
      updatePayload = [
        {
          name: "eth4",
          dhcp: false,
          optional: true,
          ipAddress: "10.10.10.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.10.1",
          dns: [],
        },
      ];

      let result = await exec();

      //Checking result
      expect(result).toBeDefined();
      expect(JSON.parse(result)).toEqual(updatePayload);

      //Checking if netplan content has been updated;
      let netplanContent = await netplanService.getSettings();
      let expectedNetplanContent = {
        fileName: netplanFileName,
        dirPath: netplanDirPath,
        interfaces: [
          {
            name: "eth4",
            dhcp: false,
            optional: true,
            ipAddress: "10.10.10.2",
            subnetMask: "255.255.255.0",
            gateway: "10.10.10.1",
            dns: [],
          },
        ],
      };

      expect(netplanContent).toEqual(expectedNetplanContent);

      //Checking if netplan file has been updated properly
      let netplanFileContent = await readFileAsync(netplanFilePath, "utf8");
      let netplanFileContentJSON = convertYamlToJSON(netplanFileContent);

      let expectedFileContent = {
        network: {
          version: 2,
          ethernets: {
            eth4: {
              dhcp4: false,
              optional: true,
              addresses: ["10.10.10.2/24"],
              gateway4: "10.10.10.1",
            },
          },
        },
      };

      expect(netplanFileContentJSON).toEqual(expectedFileContent);

      //checking if netplan command was invoked
      expect(mockExec).toHaveBeenCalledTimes(1);

      expect(mockExec.mock.calls[0][0]).toEqual("testApplyCommand");
    });

    it("should not update and return actual netplan interfaces configuration - if interface has dhcp set to false and no dns", async () => {
      updatePayload = [
        {
          name: "eth4",
          dhcp: false,
          optional: true,
          ipAddress: "10.10.10.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.10.1",
        },
      ];

      let result = await exec();

      expect(result).toEqual('"Invalid data format"');

      //Checking if netplan content has been updated;
      let netplanContent = await netplanService.getSettings();
      expect(netplanContent).toEqual(initialPayload);

      //Checking if netplan file has been updated properly
      let netplanFileContent = await readFileAsync(netplanFilePath, "utf8");
      let netplanFileContentJSON = convertYamlToJSON(netplanFileContent);

      expect(netplanFileContentJSON).toEqual(initialNetplanFileContentJSON);

      //checking if netplan command was invoked
      expect(mockExec).not.toHaveBeenCalled();
    });

    it("should not update and return actual netplan interfaces configuration - if interface has dhcp set to false and dns as null", async () => {
      updatePayload = [
        {
          name: "eth4",
          dhcp: false,
          optional: true,
          ipAddress: "10.10.10.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.10.1",
          dns: null,
        },
      ];

      let result = await exec();

      expect(result).toEqual('"Invalid data format"');

      //Checking if netplan content has been updated;
      let netplanContent = await netplanService.getSettings();
      expect(netplanContent).toEqual(initialPayload);

      //Checking if netplan file has been updated properly
      let netplanFileContent = await readFileAsync(netplanFilePath, "utf8");
      let netplanFileContentJSON = convertYamlToJSON(netplanFileContent);

      expect(netplanFileContentJSON).toEqual(initialNetplanFileContentJSON);

      //checking if netplan command was invoked
      expect(mockExec).not.toHaveBeenCalled();
    });

    it("should not update and return actual netplan interfaces configuration - if interface has dhcp set to false and dsn as non string", async () => {
      updatePayload = [
        {
          name: "eth4",
          dhcp: false,
          optional: true,
          ipAddress: "10.10.10.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.10.1",
          dns: [1234],
        },
      ];

      let result = await exec();

      expect(result).toEqual('"Invalid data format"');

      //Checking if netplan content has been updated;
      let netplanContent = await netplanService.getSettings();
      expect(netplanContent).toEqual(initialPayload);

      //Checking if netplan file has been updated properly
      let netplanFileContent = await readFileAsync(netplanFilePath, "utf8");
      let netplanFileContentJSON = convertYamlToJSON(netplanFileContent);

      expect(netplanFileContentJSON).toEqual(initialNetplanFileContentJSON);

      //checking if netplan command was invoked
      expect(mockExec).not.toHaveBeenCalled();
    });

    it("should not update and return actual netplan interfaces configuration - if interface has dhcp set to false and subnetMask as invalid string", async () => {
      updatePayload = [
        {
          name: "eth4",
          dhcp: false,
          optional: true,
          ipAddress: "10.10.10.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.10.1",
          dns: ["abcd", "1.1.1.1"],
        },
      ];

      let result = await exec();

      expect(result).toEqual('"Invalid data format"');

      //Checking if netplan content has been updated;
      let netplanContent = await netplanService.getSettings();
      expect(netplanContent).toEqual(initialPayload);

      //Checking if netplan file has been updated properly
      let netplanFileContent = await readFileAsync(netplanFilePath, "utf8");
      let netplanFileContentJSON = convertYamlToJSON(netplanFileContent);

      expect(netplanFileContentJSON).toEqual(initialNetplanFileContentJSON);

      //checking if netplan command was invoked
      expect(mockExec).not.toHaveBeenCalled();
    });

    it("should not update and return actual netplan interfaces configuration - if interface has dhcp set to false and subnetMask as address with cidr", async () => {
      updatePayload = [
        {
          name: "eth4",
          dhcp: false,
          optional: true,
          ipAddress: "10.10.10.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.10.1",
          dns: ["10.10.10.1/24", "1.1.1.1"],
        },
      ];

      let result = await exec();

      expect(result).toEqual('"Invalid data format"');

      //Checking if netplan content has been updated;
      let netplanContent = await netplanService.getSettings();
      expect(netplanContent).toEqual(initialPayload);

      //Checking if netplan file has been updated properly
      let netplanFileContent = await readFileAsync(netplanFilePath, "utf8");
      let netplanFileContentJSON = convertYamlToJSON(netplanFileContent);

      expect(netplanFileContentJSON).toEqual(initialNetplanFileContentJSON);

      //checking if netplan command was invoked
      expect(mockExec).not.toHaveBeenCalled();
    });

    it("should not update and return actual netplan interfaces configuration - if interface has dhcp set to true but ipAddress is invalid", async () => {
      updatePayload = [
        {
          name: "eth4",
          dhcp: true,
          optional: true,
          ipAddress: "abcd1234",
          subnetMask: "255.255.255.0",
          gateway: "10.10.10.1",
          dns: ["10.10.10.1", "1.1.1.1"],
        },
      ];

      let result = await exec();

      expect(result).toEqual('"Invalid data format"');

      //Checking if netplan content has been updated;
      let netplanContent = await netplanService.getSettings();
      expect(netplanContent).toEqual(initialPayload);

      //Checking if netplan file has been updated properly
      let netplanFileContent = await readFileAsync(netplanFilePath, "utf8");
      let netplanFileContentJSON = convertYamlToJSON(netplanFileContent);

      expect(netplanFileContentJSON).toEqual(initialNetplanFileContentJSON);

      //checking if netplan command was invoked
      expect(mockExec).not.toHaveBeenCalled();
    });

    it("should not update and return actual netplan interfaces configuration - if interface has dhcp set to true but gateway is invalid", async () => {
      updatePayload = [
        {
          name: "eth4",
          dhcp: true,
          optional: true,
          ipAddress: "10.10.10.2",
          subnetMask: "255.255.255.0",
          gateway: "abcd1234",
          dns: ["10.10.10.1", "1.1.1.1"],
        },
      ];

      let result = await exec();

      expect(result).toEqual('"Invalid data format"');

      //Checking if netplan content has been updated;
      let netplanContent = await netplanService.getSettings();
      expect(netplanContent).toEqual(initialPayload);

      //Checking if netplan file has been updated properly
      let netplanFileContent = await readFileAsync(netplanFilePath, "utf8");
      let netplanFileContentJSON = convertYamlToJSON(netplanFileContent);

      expect(netplanFileContentJSON).toEqual(initialNetplanFileContentJSON);

      //checking if netplan command was invoked
      expect(mockExec).not.toHaveBeenCalled();
    });

    it("should not update and return actual netplan interfaces configuration - if interface has dhcp set to true but subnetMask is invalid", async () => {
      updatePayload = [
        {
          name: "eth4",
          dhcp: true,
          optional: true,
          ipAddress: "10.10.10.2",
          subnetMask: "abcd1234",
          gateway: "10.10.10.1",
          dns: ["10.10.10.1", "1.1.1.1"],
        },
      ];

      let result = await exec();

      expect(result).toEqual('"Invalid data format"');

      //Checking if netplan content has been updated;
      let netplanContent = await netplanService.getSettings();
      expect(netplanContent).toEqual(initialPayload);

      //Checking if netplan file has been updated properly
      let netplanFileContent = await readFileAsync(netplanFilePath, "utf8");
      let netplanFileContentJSON = convertYamlToJSON(netplanFileContent);

      expect(netplanFileContentJSON).toEqual(initialNetplanFileContentJSON);

      //checking if netplan command was invoked
      expect(mockExec).not.toHaveBeenCalled();
    });

    it("should not update and return actual netplan interfaces configuration - if interface has dhcp set to true but dns is invalid", async () => {
      updatePayload = [
        {
          name: "eth4",
          dhcp: true,
          optional: true,
          ipAddress: "10.10.10.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.10.1",
          dns: "10.10.10.10",
        },
      ];

      let result = await exec();

      expect(result).toEqual('"Invalid data format"');

      //Checking if netplan content has been updated;
      let netplanContent = await netplanService.getSettings();
      expect(netplanContent).toEqual(initialPayload);

      //Checking if netplan file has been updated properly
      let netplanFileContent = await readFileAsync(netplanFilePath, "utf8");
      let netplanFileContentJSON = convertYamlToJSON(netplanFileContent);

      expect(netplanFileContentJSON).toEqual(initialNetplanFileContentJSON);

      //checking if netplan command was invoked
      expect(mockExec).not.toHaveBeenCalled();
    });
  });

  describe("HTTP PUT", () => {
    let headers;
    let initialPayload;
    let updatePayload;

    beforeEach(() => {
      initialPayload = null;
      updatePayload = [
        {
          name: "eth2",
          dhcp: true,
          optional: true,
        },
        {
          name: "eth3",
          dhcp: true,
          optional: false,
        },
        {
          name: "eth4",
          dhcp: false,
          optional: true,
          ipAddress: "10.10.10.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.10.1",
          dns: ["10.10.10.1", "1.1.1.1"],
        },
      ];

      headers = {
        "x-auth-token": appAuthToken,
        "content-type": "application/json",
      };
    });

    let exec = async () => {
      await initApp();

      initialPayload = await netplanService.getSettings();

      return sendHTTPPutToSocket(
        socketFilePath,
        "/",
        headers,
        JSON.stringify(updatePayload)
      );
    };

    it("should not update and return actual netplan interfaces configuration", async () => {
      let result = await exec();

      expect(result).toEqual("invalid http function");

      //Checking if netplan content has been updated;
      let netplanContent = await netplanService.getSettings();
      expect(netplanContent).toEqual(initialPayload);

      //Checking if netplan file has been updated properly
      let netplanFileContent = await readFileAsync(netplanFilePath, "utf8");
      let netplanFileContentJSON = convertYamlToJSON(netplanFileContent);

      expect(netplanFileContentJSON).toEqual(initialNetplanFileContentJSON);

      //checking if netplan command was invoked
      expect(mockExec).not.toHaveBeenCalled();
    });

    it("should not update and return actual netplan interfaces configuration - if token was not added in headers", async () => {
      headers = {};

      let result = await exec();

      expect(result).toEqual("Access forbidden.");

      //Checking if netplan content has been updated;
      let netplanContent = await netplanService.getSettings();
      expect(netplanContent).toEqual(initialPayload);

      //Checking if netplan file has been updated properly
      let netplanFileContent = await readFileAsync(netplanFilePath, "utf8");
      let netplanFileContentJSON = convertYamlToJSON(netplanFileContent);

      expect(netplanFileContentJSON).toEqual(initialNetplanFileContentJSON);

      //checking if netplan command was invoked
      expect(mockExec).not.toHaveBeenCalled();
    });

    it("should not update and return actual netplan interfaces configuration - if token is null in headers", async () => {
      headers = { "x-auth-token": null };

      let result = await exec();

      expect(result).toEqual("Access forbidden.");

      //Checking if netplan content has been updated;
      let netplanContent = await netplanService.getSettings();
      expect(netplanContent).toEqual(initialPayload);

      //Checking if netplan file has been updated properly
      let netplanFileContent = await readFileAsync(netplanFilePath, "utf8");
      let netplanFileContentJSON = convertYamlToJSON(netplanFileContent);

      expect(netplanFileContentJSON).toEqual(initialNetplanFileContentJSON);

      //checking if netplan command was invoked
      expect(mockExec).not.toHaveBeenCalled();
    });

    it("should not update and return actual netplan interfaces configuration - if token is not a valid string", async () => {
      headers = { "x-auth-token": 1234 };

      let result = await exec();

      expect(result).toEqual("Access forbidden.");

      //Checking if netplan content has been updated;
      let netplanContent = await netplanService.getSettings();
      expect(netplanContent).toEqual(initialPayload);

      //Checking if netplan file has been updated properly
      let netplanFileContent = await readFileAsync(netplanFilePath, "utf8");
      let netplanFileContentJSON = convertYamlToJSON(netplanFileContent);

      expect(netplanFileContentJSON).toEqual(initialNetplanFileContentJSON);

      //checking if netplan command was invoked
      expect(mockExec).not.toHaveBeenCalled();
    });

    it("should not update and return actual netplan interfaces configuration - if token is invalid", async () => {
      headers = { "x-auth-token": "fakeToken" };

      let result = await exec();

      expect(result).toEqual("Access forbidden.");

      //Checking if netplan content has been updated;
      let netplanContent = await netplanService.getSettings();
      expect(netplanContent).toEqual(initialPayload);

      //Checking if netplan file has been updated properly
      let netplanFileContent = await readFileAsync(netplanFilePath, "utf8");
      let netplanFileContentJSON = convertYamlToJSON(netplanFileContent);

      expect(netplanFileContentJSON).toEqual(initialNetplanFileContentJSON);

      //checking if netplan command was invoked
      expect(mockExec).not.toHaveBeenCalled();
    });
  });
});
