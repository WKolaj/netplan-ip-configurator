describe("NetplanService - client", () => {
  const initPackages = () => {
    //mocking child_process exec
    child_proccess = require("child_process");
    mockExec = jest.fn();
    child_proccess.exec = (command, callback) => {
      mockExec(command);
      callback();
    };

    config = require("config");
    path = require("path");
    appAuthToken = config.get("appAuthToken");
    socketDirPath = config.get("socketDirPath");
    socketFileName = config.get("socketFileName");
    socketFilePath = path.join(socketDirPath, socketFileName);
    netplanDirPath = config.get("netplanDirPath");
    netplanFileName = config.get("netplanFileName");
    netplanFilePath = path.join(netplanDirPath, netplanFileName);
    let utilities = require("../../../utilities/utilities");
    clearDirectoryAsync = utilities.clearDirectoryAsync;
    snooze = utilities.snooze;
    writeFileAsync = utilities.writeFileAsync;
    convertJSONToYaml = utilities.convertJSONToYaml;
    readFileAsync = utilities.readFileAsync;
    convertYamlToJSON = utilities.convertYamlToJSON;

    let testUtilities = require("../../utilities/testUtilities");
    sendHTTPPostToSocket = testUtilities.sendHTTPPostToSocket;
    sendHTTPGetToSocket = testUtilities.sendHTTPGetToSocket;
    sendHTTPPutToSocket = testUtilities.sendHTTPPutToSocket;
    netplanClientService = require("../../../client/services/netplanService");
    interprocessComService = require("../../../services/interprocessCommunicationService");
    interProcessCommunication = require("../../../startup/interProcessCommunication");
  };

  let child_proccess;
  let mockExec;
  let config;
  let path;
  let appAuthToken;
  let socketDirPath;
  let socketFileName;
  let socketFilePath;
  let netplanDirPath;
  let netplanFileName;
  let netplanFilePath;
  let clearDirectoryAsync;
  let snooze;
  let writeFileAsync;
  let convertJSONToYaml;
  let readFileAsync;
  let convertYamlToJSON;
  let sendHTTPPostToSocket;
  let sendHTTPGetToSocket;
  let sendHTTPPutToSocket;

  let netplanClientService;
  let interprocessComService;
  let interProcessCommunication;

  let initialNetplanFileContentJSON;
  let initialNetplanFileContent;
  let createInitialNetplanFile;
  let runServer;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.resetModules();

    initPackages();

    //Clear fake netplan dir
    await clearDirectoryAsync(netplanDirPath);

    createInitialNetplanFile = true;
    runServer = true;

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
    await interprocessComService.stopAndDelete();
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
    if (runServer) await require("../../../server");
  };

  describe("getInterfaces", () => {
    let headers;
    let clientSocket;
    let clientToken;

    beforeEach(() => {
      headers = {
        "x-auth-token": appAuthToken,
      };
      clientSocket = socketFilePath;
      clientToken = appAuthToken;
    });

    let exec = async () => {
      await initApp();
      await netplanClientService.init(clientSocket, clientToken);
      return netplanClientService.getInterfaces();
    };

    it("should return actual netplan interfaces configuration object", async () => {
      let result = await exec();
      expect(result).toBeDefined();
      expect(result).toEqual({
        eth1: { name: "eth1", dhcp: true, optional: true },
        eth2: {
          name: "eth2",
          dhcp: false,
          optional: false,
          ipAddress: "10.10.10.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.10.1",
          dns: ["10.10.10.1", "1.1.1.1"],
        },
      });
    });

    it("should return actual netplan interfaces configuration object - if there are no interfaces", async () => {
      initialNetplanFileContentJSON.network.ethernets = {};
      let result = await exec();

      expect(result).toBeDefined();

      expect(result).toEqual({});
    });

    it("should not throw and return null - if server app is not initialized", async () => {
      runServer = false;

      let result = await exec();

      expect(result).toEqual(null);
    });
  });
});
