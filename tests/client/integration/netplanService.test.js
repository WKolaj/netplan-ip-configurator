const { getInterfaces } = require("../../../client/services/netplanService");

describe("NetplanService - client", () => {
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
    let initClient;

    beforeEach(() => {
      clientSocket = socketFilePath;
      clientToken = appAuthToken;
      initClient = true;
    });

    let exec = async () => {
      await initApp();
      if (initClient)
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

    it("should return actual netplan interfaces configuration object - if there is no gateway4 in netplan file", async () => {
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
              nameservers: { addresses: ["10.10.10.1", "1.1.1.1"] },
              optional: false,
            },
          },
        },
      };

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
          gateway: "0.0.0.0",
          dns: ["10.10.10.1", "1.1.1.1"],
        },
      });
    });

    it("should return actual netplan interfaces configuration object - if there is gateway4 in file set to 0.0.0.0", async () => {
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
              nameservers: { addresses: ["10.10.10.1", "1.1.1.1"] },
              gateway4: "0.0.0.0",
              optional: false,
            },
          },
        },
      };

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
          gateway: "0.0.0.0",
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

    it("should return actual netplan interfaces configuration object - if one of interfaces has dhcp set to true but other network params set to static", async () => {
      initialNetplanFileContentJSON = {
        network: {
          version: 2,
          ethernets: {
            eth1: {
              dhcp4: true,
              optional: true,
            },
            eth2: {
              dhcp4: true,
              addresses: ["10.10.10.2/24"],
              gateway4: "10.10.10.1",
              nameservers: { addresses: ["10.10.10.1", "1.1.1.1"] },
              optional: false,
            },
          },
        },
      };

      let result = await exec();

      expect(result).toBeDefined();

      expect(result).toEqual({
        eth1: { name: "eth1", dhcp: true, optional: true },
        eth2: {
          name: "eth2",
          dhcp: true,
          optional: false,
        },
      });
    });

    it("should not throw and return null - if server app is not initialized", async () => {
      runServer = false;

      let result = await exec();

      expect(result).toEqual(null);
    });

    it("should not throw and return null - if client was not initialized", async () => {
      initClient = false;

      let result = await exec();

      expect(result).toEqual(null);
    });

    it("should not throw and return empty object - if netplan file was not initially created", async () => {
      createInitialNetplanFile = false;

      let result = await exec();

      expect(result).toEqual({});
    });

    it("should not throw and return null - if token is invalid", async () => {
      clientToken = "fakeId";

      let result = await exec();

      expect(result).toEqual(null);
    });

    it("should not throw and return null - if token is null", async () => {
      clientToken = null;

      let result = await exec();

      expect(result).toEqual(null);
    });

    it("should not throw and return null - if token is undefined", async () => {
      clientToken = undefined;

      let result = await exec();

      expect(result).toEqual(null);
    });
  });

  describe("getInterface", () => {
    let headers;
    let clientSocket;
    let clientToken;
    let initClient;
    let interfaceName;

    beforeEach(() => {
      clientSocket = socketFilePath;
      clientToken = appAuthToken;
      initClient = true;
      interfaceName = "eth2";
    });

    let exec = async () => {
      await initApp();
      if (initClient)
        await netplanClientService.init(clientSocket, clientToken);

      return netplanClientService.getInterface(interfaceName);
    };

    it("should return actual netplan interface configuration object", async () => {
      let result = await exec();
      expect(result).toBeDefined();
      expect(result).toEqual({
        name: "eth2",
        dhcp: false,
        optional: false,
        ipAddress: "10.10.10.2",
        subnetMask: "255.255.255.0",
        gateway: "10.10.10.1",
        dns: ["10.10.10.1", "1.1.1.1"],
      });
    });

    it("should return actual netplan interface configuration object - if gateway is not set in file", async () => {
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
              nameservers: { addresses: ["10.10.10.1", "1.1.1.1"] },
              optional: false,
            },
          },
        },
      };

      let result = await exec();
      expect(result).toBeDefined();
      expect(result).toEqual({
        name: "eth2",
        dhcp: false,
        optional: false,
        ipAddress: "10.10.10.2",
        subnetMask: "255.255.255.0",
        gateway: "0.0.0.0",
        dns: ["10.10.10.1", "1.1.1.1"],
      });
    });

    it("should return actual netplan interface configuration object - if gateway is set to 0.0.0.0 in file", async () => {
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
              gateway4: "0.0.0.0",
              nameservers: { addresses: ["10.10.10.1", "1.1.1.1"] },
              optional: false,
            },
          },
        },
      };

      let result = await exec();
      expect(result).toBeDefined();
      expect(result).toEqual({
        name: "eth2",
        dhcp: false,
        optional: false,
        ipAddress: "10.10.10.2",
        subnetMask: "255.255.255.0",
        gateway: "0.0.0.0",
        dns: ["10.10.10.1", "1.1.1.1"],
      });
    });

    it("should return null - if there are no interfaces", async () => {
      initialNetplanFileContentJSON.network.ethernets = {};
      let result = await exec();

      expect(result).toBeDefined();

      expect(result).toEqual(null);
    });

    it("should return null - if there are is no interface of given name", async () => {
      interfaceName = "fakeName";

      let result = await exec();

      expect(result).toBeDefined();

      expect(result).toEqual(null);
    });

    it("should return actual netplan interface configuration object - if nterface has dhcp set to true but other network params set to static", async () => {
      initialNetplanFileContentJSON = {
        network: {
          version: 2,
          ethernets: {
            eth2: {
              dhcp4: true,
              addresses: ["10.10.10.2/24"],
              gateway4: "10.10.10.1",
              nameservers: { addresses: ["10.10.10.1", "1.1.1.1"] },
              optional: false,
            },
          },
        },
      };

      let result = await exec();

      expect(result).toBeDefined();

      expect(result).toEqual({
        name: "eth2",
        dhcp: true,
        optional: false,
      });
    });

    it("should not throw and return null - if server app is not initialized", async () => {
      runServer = false;

      let result = await exec();

      expect(result).toEqual(null);
    });

    it("should not throw and return null - if client was not initialized", async () => {
      initClient = false;

      let result = await exec();

      expect(result).toEqual(null);
    });

    it("should not throw and return null (no ethernet interface of given name) - if netplan file was not initially created", async () => {
      createInitialNetplanFile = false;

      let result = await exec();

      expect(result).toEqual(null);
    });

    it("should not throw and return null - if token is invalid", async () => {
      clientToken = "fakeId";

      let result = await exec();

      expect(result).toEqual(null);
    });

    it("should not throw and return null - if token is null", async () => {
      clientToken = null;

      let result = await exec();

      expect(result).toEqual(null);
    });

    it("should not throw and return null - if token is undefined", async () => {
      clientToken = undefined;

      let result = await exec();

      expect(result).toEqual(null);
    });
  });

  describe("setInterfaces", () => {
    let headers;
    let clientSocket;
    let clientToken;
    let initClient;
    let newPayload;
    let initialPayload;

    beforeEach(() => {
      clientSocket = socketFilePath;
      clientToken = appAuthToken;
      initClient = true;
      newPayload = {
        eth2: { name: "eth2", dhcp: true, optional: true },
        eth3: {
          name: "eth3",
          dhcp: false,
          optional: false,
          ipAddress: "10.10.10.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.10.1",
          dns: ["10.10.10.1", "1.1.1.1"],
        },
        eth4: {
          name: "eth4",
          dhcp: false,
          optional: true,
          ipAddress: "10.10.11.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.11.1",
          dns: ["10.10.11.1", "1.1.1.1"],
        },
      };
    });

    let exec = async () => {
      await initApp();
      if (initClient)
        await netplanClientService.init(clientSocket, clientToken);

      initialPayload = await netplanClientService.getInterfaces();
      return netplanClientService.setInterfaces(newPayload);
    };

    it("should update interfaces and return new netplan interfaces configuration object", async () => {
      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(newPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(newPayload);
    });

    it("should update interfaces and return new netplan interfaces configuration object - id gateway is set to 0.0.0.0", async () => {
      newPayload = {
        eth2: { name: "eth2", dhcp: true, optional: true },
        eth3: {
          name: "eth3",
          dhcp: false,
          optional: false,
          ipAddress: "10.10.10.2",
          subnetMask: "255.255.255.0",
          gateway: "0.0.0.0",
          dns: ["10.10.10.1", "1.1.1.1"],
        },
        eth4: {
          name: "eth4",
          dhcp: false,
          optional: true,
          ipAddress: "10.10.11.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.11.1",
          dns: ["10.10.11.1", "1.1.1.1"],
        },
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(newPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(newPayload);
    });

    it("should update interfaces and return new netplan interfaces configuration object - even if new interface config is empty", async () => {
      newPayload = {};

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(newPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(newPayload);
    });

    it("should update interfaces and return new netplan interfaces configuration object - if there are no interfaces at the begining", async () => {
      initialNetplanFileContentJSON.network.ethernets = {};

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(newPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(newPayload);
    });

    it("should update interfaces and return new netplan interfaces configuration object - if one of interfaces has dhcp set to true but other network params set to static", async () => {
      newPayload = {
        eth2: { name: "eth2", dhcp: true, optional: true },
        eth3: {
          name: "eth3",
          dhcp: true,
          optional: false,
          ipAddress: "10.10.10.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.10.1",
          dns: ["10.10.10.1", "1.1.1.1"],
        },
        eth4: {
          name: "eth4",
          dhcp: false,
          optional: true,
          ipAddress: "10.10.11.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.11.1",
          dns: ["10.10.11.1", "1.1.1.1"],
        },
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      let expectedPayload = {
        eth2: { name: "eth2", dhcp: true, optional: true },
        eth3: {
          name: "eth3",
          dhcp: true,
          optional: false,
        },
        eth4: {
          name: "eth4",
          dhcp: false,
          optional: true,
          ipAddress: "10.10.11.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.11.1",
          dns: ["10.10.11.1", "1.1.1.1"],
        },
      };

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(expectedPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(expectedPayload);
    });

    it("should not update interfaces and return null - if name of one of interfaces is not given", async () => {
      newPayload = {
        eth2: { name: "eth2", dhcp: true, optional: true },
        eth3: {
          dhcp: false,
          optional: false,
          ipAddress: "10.10.10.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.10.1",
          dns: ["10.10.10.1", "1.1.1.1"],
        },
        eth4: {
          name: "eth4",
          dhcp: false,
          optional: true,
          ipAddress: "10.10.11.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.11.1",
          dns: ["10.10.11.1", "1.1.1.1"],
        },
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not update interfaces and return null - if name of one of interfaces is null", async () => {
      newPayload = {
        eth2: { name: "eth2", dhcp: true, optional: true },
        eth3: {
          name: null,
          dhcp: false,
          optional: false,
          ipAddress: "10.10.10.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.10.1",
          dns: ["10.10.10.1", "1.1.1.1"],
        },
        eth4: {
          name: "eth4",
          dhcp: false,
          optional: true,
          ipAddress: "10.10.11.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.11.1",
          dns: ["10.10.11.1", "1.1.1.1"],
        },
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not update interfaces and return null - if name of one of interfaces is not a string", async () => {
      newPayload = {
        eth2: { name: "eth2", dhcp: true, optional: true },
        eth3: {
          name: 1234,
          dhcp: false,
          optional: false,
          ipAddress: "10.10.10.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.10.1",
          dns: ["10.10.10.1", "1.1.1.1"],
        },
        eth4: {
          name: "eth4",
          dhcp: false,
          optional: true,
          ipAddress: "10.10.11.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.11.1",
          dns: ["10.10.11.1", "1.1.1.1"],
        },
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should update interfaces and return new netplan interfaces configuration object - if name from config object of interface does not correspond to key - name in object is taken into account", async () => {
      newPayload = {
        eth2: { name: "eth2", dhcp: true, optional: true },
        eth3: {
          name: "eth5",
          dhcp: false,
          optional: false,
          ipAddress: "10.10.10.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.10.1",
          dns: ["10.10.10.1", "1.1.1.1"],
        },
        eth4: {
          name: "eth4",
          dhcp: false,
          optional: true,
          ipAddress: "10.10.11.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.11.1",
          dns: ["10.10.11.1", "1.1.1.1"],
        },
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      let expectedPayload = {
        eth2: { name: "eth2", dhcp: true, optional: true },
        eth5: {
          name: "eth5",
          dhcp: false,
          optional: false,
          ipAddress: "10.10.10.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.10.1",
          dns: ["10.10.10.1", "1.1.1.1"],
        },
        eth4: {
          name: "eth4",
          dhcp: false,
          optional: true,
          ipAddress: "10.10.11.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.11.1",
          dns: ["10.10.11.1", "1.1.1.1"],
        },
      };

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(expectedPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(expectedPayload);
    });

    it("should not update interfaces and return null - if name from config object of interface does not correspond to key, but name already exists in different key", async () => {
      newPayload = {
        eth2: { name: "eth2", dhcp: true, optional: true },
        eth3: {
          name: "eth2",
          dhcp: false,
          optional: false,
          ipAddress: "10.10.10.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.10.1",
          dns: ["10.10.10.1", "1.1.1.1"],
        },
        eth4: {
          name: "eth4",
          dhcp: false,
          optional: true,
          ipAddress: "10.10.11.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.11.1",
          dns: ["10.10.11.1", "1.1.1.1"],
        },
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not update interfaces and return null - if optional of one of interfaces is not given", async () => {
      newPayload = {
        eth2: { name: "eth2", dhcp: true, optional: true },
        eth3: {
          name: "eth3",
          dhcp: false,
          ipAddress: "10.10.10.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.10.1",
          dns: ["10.10.10.1", "1.1.1.1"],
        },
        eth4: {
          name: "eth4",
          dhcp: false,
          optional: true,
          ipAddress: "10.10.11.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.11.1",
          dns: ["10.10.11.1", "1.1.1.1"],
        },
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not update interfaces and return null - if optional of one of interfaces is null", async () => {
      newPayload = {
        eth2: { name: "eth2", dhcp: true, optional: true },
        eth3: {
          name: "eth3",
          dhcp: false,
          optional: null,
          ipAddress: "10.10.10.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.10.1",
          dns: ["10.10.10.1", "1.1.1.1"],
        },
        eth4: {
          name: "eth4",
          dhcp: false,
          optional: true,
          ipAddress: "10.10.11.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.11.1",
          dns: ["10.10.11.1", "1.1.1.1"],
        },
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not update interfaces and return null - if optional of one of interfaces is not a boolean", async () => {
      newPayload = {
        eth2: { name: "eth2", dhcp: true, optional: true },
        eth3: {
          name: "eth3",
          dhcp: false,
          optional: 1234,
          ipAddress: "10.10.10.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.10.1",
          dns: ["10.10.10.1", "1.1.1.1"],
        },
        eth4: {
          name: "eth4",
          dhcp: false,
          optional: true,
          ipAddress: "10.10.11.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.11.1",
          dns: ["10.10.11.1", "1.1.1.1"],
        },
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not update interfaces and return null - if dhcp is not given", async () => {
      newPayload = {
        eth2: { name: "eth2", dhcp: true, optional: true },
        eth3: {
          optional: false,
          name: "eth3",
          ipAddress: "10.10.10.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.10.1",
          dns: ["10.10.10.1", "1.1.1.1"],
        },
        eth4: {
          name: "eth4",
          dhcp: false,
          optional: true,
          ipAddress: "10.10.11.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.11.1",
          dns: ["10.10.11.1", "1.1.1.1"],
        },
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not update interfaces and return null - if dhcp of one of interfaces is null", async () => {
      newPayload = {
        eth2: { name: "eth2", dhcp: true, optional: true },
        eth3: {
          name: "eth3",
          dhcp: null,
          optional: false,
          ipAddress: "10.10.10.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.10.1",
          dns: ["10.10.10.1", "1.1.1.1"],
        },
        eth4: {
          name: "eth4",
          dhcp: false,
          optional: true,
          ipAddress: "10.10.11.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.11.1",
          dns: ["10.10.11.1", "1.1.1.1"],
        },
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not update interfaces and return null - if dhcp of one of interfaces is not a boolean", async () => {
      newPayload = {
        eth2: { name: "eth2", dhcp: true, optional: true },
        eth3: {
          name: "eth3",
          dhcp: 1234,
          optional: false,
          ipAddress: "10.10.10.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.10.1",
          dns: ["10.10.10.1", "1.1.1.1"],
        },
        eth4: {
          name: "eth4",
          dhcp: false,
          optional: true,
          ipAddress: "10.10.11.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.11.1",
          dns: ["10.10.11.1", "1.1.1.1"],
        },
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not update interfaces and return null - if dhcp is false and there is no ipAddress", async () => {
      newPayload = {
        eth2: { name: "eth2", dhcp: true, optional: true },
        eth3: {
          name: "eth3",
          dhcp: false,
          optional: false,
          subnetMask: "255.255.255.0",
          gateway: "10.10.10.1",
          dns: ["10.10.10.1", "1.1.1.1"],
        },
        eth4: {
          name: "eth4",
          dhcp: false,
          optional: true,
          ipAddress: "10.10.11.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.11.1",
          dns: ["10.10.11.1", "1.1.1.1"],
        },
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not update interfaces and return null - if dhcp is false and ipAddress is null", async () => {
      newPayload = {
        eth2: { name: "eth2", dhcp: true, optional: true },
        eth3: {
          name: "eth3",
          dhcp: false,
          optional: false,
          ipAddress: null,
          subnetMask: "255.255.255.0",
          gateway: "10.10.10.1",
          dns: ["10.10.10.1", "1.1.1.1"],
        },
        eth4: {
          name: "eth4",
          dhcp: false,
          optional: true,
          ipAddress: "10.10.11.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.11.1",
          dns: ["10.10.11.1", "1.1.1.1"],
        },
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not update interfaces and return null - if dhcp is false and ipAddress is not a string", async () => {
      newPayload = {
        eth2: { name: "eth2", dhcp: true, optional: true },
        eth3: {
          name: "eth3",
          dhcp: false,
          optional: false,
          ipAddress: 1234,
          subnetMask: "255.255.255.0",
          gateway: "10.10.10.1",
          dns: ["10.10.10.1", "1.1.1.1"],
        },
        eth4: {
          name: "eth4",
          dhcp: false,
          optional: true,
          ipAddress: "10.10.11.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.11.1",
          dns: ["10.10.11.1", "1.1.1.1"],
        },
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not update interfaces and return null - if dhcp is false and ipAddress is not a valid ipAddress", async () => {
      newPayload = {
        eth2: { name: "eth2", dhcp: true, optional: true },
        eth3: {
          name: "eth3",
          dhcp: false,
          optional: false,
          ipAddress: "fakeIP",
          subnetMask: "255.255.255.0",
          gateway: "10.10.10.1",
          dns: ["10.10.10.1", "1.1.1.1"],
        },
        eth4: {
          name: "eth4",
          dhcp: false,
          optional: true,
          ipAddress: "10.10.11.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.11.1",
          dns: ["10.10.11.1", "1.1.1.1"],
        },
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not update interfaces and return null - if dhcp is false and ipAddress is ipAddress with CIDR", async () => {
      newPayload = {
        eth2: { name: "eth2", dhcp: true, optional: true },
        eth3: {
          name: "eth3",
          dhcp: false,
          optional: false,
          ipAddress: "10.10.10.2/24",
          subnetMask: "255.255.255.0",
          gateway: "10.10.10.1",
          dns: ["10.10.10.1", "1.1.1.1"],
        },
        eth4: {
          name: "eth4",
          dhcp: false,
          optional: true,
          ipAddress: "10.10.11.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.11.1",
          dns: ["10.10.11.1", "1.1.1.1"],
        },
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not update interfaces and return null - if dhcp is true and ipAddress is null", async () => {
      newPayload = {
        eth2: { name: "eth2", dhcp: true, optional: true },
        eth3: {
          name: "eth3",
          dhcp: true,
          optional: false,
          ipAddress: null,
          subnetMask: "255.255.255.0",
          gateway: "10.10.10.1",
          dns: ["10.10.10.1", "1.1.1.1"],
        },
        eth4: {
          name: "eth4",
          dhcp: false,
          optional: true,
          ipAddress: "10.10.11.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.11.1",
          dns: ["10.10.11.1", "1.1.1.1"],
        },
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not update interfaces and return null - if dhcp is true and ipAddress is not a string", async () => {
      newPayload = {
        eth2: { name: "eth2", dhcp: true, optional: true },
        eth3: {
          name: "eth3",
          dhcp: true,
          optional: false,
          ipAddress: 1234,
          subnetMask: "255.255.255.0",
          gateway: "10.10.10.1",
          dns: ["10.10.10.1", "1.1.1.1"],
        },
        eth4: {
          name: "eth4",
          dhcp: false,
          optional: true,
          ipAddress: "10.10.11.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.11.1",
          dns: ["10.10.11.1", "1.1.1.1"],
        },
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not update interfaces and return null - if dhcp is true and ipAddress is not a valid ipAddress", async () => {
      newPayload = {
        eth2: { name: "eth2", dhcp: true, optional: true },
        eth3: {
          name: "eth3",
          dhcp: true,
          optional: false,
          ipAddress: "fakeIP",
          subnetMask: "255.255.255.0",
          gateway: "10.10.10.1",
          dns: ["10.10.10.1", "1.1.1.1"],
        },
        eth4: {
          name: "eth4",
          dhcp: false,
          optional: true,
          ipAddress: "10.10.11.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.11.1",
          dns: ["10.10.11.1", "1.1.1.1"],
        },
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not update interfaces and return null - if dhcp is true and ipAddress is ipAddress with CIDR", async () => {
      newPayload = {
        eth2: { name: "eth2", dhcp: true, optional: true },
        eth3: {
          name: "eth3",
          dhcp: true,
          optional: false,
          ipAddress: "10.10.10.2/24",
          subnetMask: "255.255.255.0",
          gateway: "10.10.10.1",
          dns: ["10.10.10.1", "1.1.1.1"],
        },
        eth4: {
          name: "eth4",
          dhcp: false,
          optional: true,
          ipAddress: "10.10.11.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.11.1",
          dns: ["10.10.11.1", "1.1.1.1"],
        },
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not update interfaces and return null - if dhcp is false and there is no subnetMask", async () => {
      newPayload = {
        eth2: { name: "eth2", dhcp: true, optional: true },
        eth3: {
          name: "eth3",
          dhcp: false,
          optional: false,
          ipAddress: "10.10.10.2",
          gateway: "10.10.10.1",
          dns: ["10.10.10.1", "1.1.1.1"],
        },
        eth4: {
          name: "eth4",
          dhcp: false,
          optional: true,
          ipAddress: "10.10.11.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.11.1",
          dns: ["10.10.11.1", "1.1.1.1"],
        },
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not update interfaces and return null - if dhcp is false and subnetMask is null", async () => {
      newPayload = {
        eth2: { name: "eth2", dhcp: true, optional: true },
        eth3: {
          name: "eth3",
          dhcp: false,
          optional: false,
          ipAddress: "10.10.10.2",
          subnetMask: null,
          gateway: "10.10.10.1",
          dns: ["10.10.10.1", "1.1.1.1"],
        },
        eth4: {
          name: "eth4",
          dhcp: false,
          optional: true,
          ipAddress: "10.10.11.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.11.1",
          dns: ["10.10.11.1", "1.1.1.1"],
        },
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not update interfaces and return null - if dhcp is false and subnetMask is not a string", async () => {
      newPayload = {
        eth2: { name: "eth2", dhcp: true, optional: true },
        eth3: {
          name: "eth3",
          dhcp: false,
          optional: false,
          ipAddress: "10.10.10.2",
          subnetMask: 1234,
          gateway: "10.10.10.1",
          dns: ["10.10.10.1", "1.1.1.1"],
        },
        eth4: {
          name: "eth4",
          dhcp: false,
          optional: true,
          ipAddress: "10.10.11.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.11.1",
          dns: ["10.10.11.1", "1.1.1.1"],
        },
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not update interfaces and return null - if dhcp is false and subnetMask is not a valid ipAddress", async () => {
      newPayload = {
        eth2: { name: "eth2", dhcp: true, optional: true },
        eth3: {
          name: "eth3",
          dhcp: false,
          optional: false,
          ipAddress: "10.10.10.2",
          subnetMask: "fakeIP",
          gateway: "10.10.10.1",
          dns: ["10.10.10.1", "1.1.1.1"],
        },
        eth4: {
          name: "eth4",
          dhcp: false,
          optional: true,
          ipAddress: "10.10.11.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.11.1",
          dns: ["10.10.11.1", "1.1.1.1"],
        },
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not update interfaces and return null - if dhcp is false and subnetMask is ipAddress with CIDR", async () => {
      newPayload = {
        eth2: { name: "eth2", dhcp: true, optional: true },
        eth3: {
          name: "eth3",
          dhcp: false,
          optional: false,
          ipAddress: "10.10.10.2",
          subnetMask: "255.255.255.0/24",
          gateway: "10.10.10.1",
          dns: ["10.10.10.1", "1.1.1.1"],
        },
        eth4: {
          name: "eth4",
          dhcp: false,
          optional: true,
          ipAddress: "10.10.11.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.11.1",
          dns: ["10.10.11.1", "1.1.1.1"],
        },
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not update interfaces and return null - if dhcp is true and subnetMask is null", async () => {
      newPayload = {
        eth2: { name: "eth2", dhcp: true, optional: true },
        eth3: {
          name: "eth3",
          dhcp: true,
          optional: false,
          ipAddress: "10.10.10.2",
          subnetMask: null,
          gateway: "10.10.10.1",
          dns: ["10.10.10.1", "1.1.1.1"],
        },
        eth4: {
          name: "eth4",
          dhcp: false,
          optional: true,
          ipAddress: "10.10.11.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.11.1",
          dns: ["10.10.11.1", "1.1.1.1"],
        },
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not update interfaces and return null - if dhcp is true and subnetMask is not a string", async () => {
      newPayload = {
        eth2: { name: "eth2", dhcp: true, optional: true },
        eth3: {
          name: "eth3",
          dhcp: true,
          optional: false,
          ipAddress: "10.10.10.2",
          subnetMask: 1234,
          gateway: "10.10.10.1",
          dns: ["10.10.10.1", "1.1.1.1"],
        },
        eth4: {
          name: "eth4",
          dhcp: false,
          optional: true,
          ipAddress: "10.10.11.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.11.1",
          dns: ["10.10.11.1", "1.1.1.1"],
        },
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not update interfaces and return null - if dhcp is true and subnetMask is not a valid ipAddress", async () => {
      newPayload = {
        eth2: { name: "eth2", dhcp: true, optional: true },
        eth3: {
          name: "eth3",
          dhcp: true,
          optional: false,
          ipAddress: "10.10.10.2",
          subnetMask: "fakeIP",
          gateway: "10.10.10.1",
          dns: ["10.10.10.1", "1.1.1.1"],
        },
        eth4: {
          name: "eth4",
          dhcp: false,
          optional: true,
          ipAddress: "10.10.11.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.11.1",
          dns: ["10.10.11.1", "1.1.1.1"],
        },
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not update interfaces and return null - if dhcp is true and subnetMask is ipAddress with CIDR", async () => {
      newPayload = {
        eth2: { name: "eth2", dhcp: true, optional: true },
        eth3: {
          name: "eth3",
          dhcp: true,
          optional: false,
          ipAddress: "10.10.10.2",
          subnetMask: "255.255.255.0/24",
          gateway: "10.10.10.1",
          dns: ["10.10.10.1", "1.1.1.1"],
        },
        eth4: {
          name: "eth4",
          dhcp: false,
          optional: true,
          ipAddress: "10.10.11.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.11.1",
          dns: ["10.10.11.1", "1.1.1.1"],
        },
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not update interfaces and return null - if dhcp is false and there is no gateway", async () => {
      newPayload = {
        eth2: { name: "eth2", dhcp: true, optional: true },
        eth3: {
          name: "eth3",
          dhcp: false,
          optional: false,
          ipAddress: "10.10.10.2",
          subnetMask: "255.255.255.0",
          dns: ["10.10.10.1", "1.1.1.1"],
        },
        eth4: {
          name: "eth4",
          dhcp: false,
          optional: true,
          ipAddress: "10.10.11.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.11.1",
          dns: ["10.10.11.1", "1.1.1.1"],
        },
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not update interfaces and return null - if dhcp is false and gateway is null", async () => {
      newPayload = {
        eth2: { name: "eth2", dhcp: true, optional: true },
        eth3: {
          name: "eth3",
          dhcp: false,
          optional: false,
          ipAddress: "10.10.10.2",
          subnetMask: "255.255.255.0",
          gateway: null,
          dns: ["10.10.10.1", "1.1.1.1"],
        },
        eth4: {
          name: "eth4",
          dhcp: false,
          optional: true,
          ipAddress: "10.10.11.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.11.1",
          dns: ["10.10.11.1", "1.1.1.1"],
        },
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not update interfaces and return null - if dhcp is false and gateway is not a string", async () => {
      newPayload = {
        eth2: { name: "eth2", dhcp: true, optional: true },
        eth3: {
          name: "eth3",
          dhcp: false,
          optional: false,
          ipAddress: "10.10.10.2",
          subnetMask: "255.255.255.0",
          gateway: 1234,
          dns: ["10.10.10.1", "1.1.1.1"],
        },
        eth4: {
          name: "eth4",
          dhcp: false,
          optional: true,
          ipAddress: "10.10.11.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.11.1",
          dns: ["10.10.11.1", "1.1.1.1"],
        },
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not update interfaces and return null - if dhcp is false and gateway is not a valid ipAddress", async () => {
      newPayload = {
        eth2: { name: "eth2", dhcp: true, optional: true },
        eth3: {
          name: "eth3",
          dhcp: false,
          optional: false,
          ipAddress: "10.10.10.2",
          subnetMask: "255.255.255.0",
          gateway: "fakeIP",
          dns: ["10.10.10.1", "1.1.1.1"],
        },
        eth4: {
          name: "eth4",
          dhcp: false,
          optional: true,
          ipAddress: "10.10.11.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.11.1",
          dns: ["10.10.11.1", "1.1.1.1"],
        },
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not update interfaces and return null - if dhcp is false and gateway is ipAddress with CIDR", async () => {
      newPayload = {
        eth2: { name: "eth2", dhcp: true, optional: true },
        eth3: {
          name: "eth3",
          dhcp: false,
          optional: false,
          ipAddress: "10.10.10.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.10.1/24",
          dns: ["10.10.10.1", "1.1.1.1"],
        },
        eth4: {
          name: "eth4",
          dhcp: false,
          optional: true,
          ipAddress: "10.10.11.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.11.1",
          dns: ["10.10.11.1", "1.1.1.1"],
        },
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not update interfaces and return null - if dhcp is true and gateway is null", async () => {
      newPayload = {
        eth2: { name: "eth2", dhcp: true, optional: true },
        eth3: {
          name: "eth3",
          dhcp: true,
          optional: false,
          ipAddress: "10.10.10.2",
          subnetMask: "255.255.255.0",
          gateway: null,
          dns: ["10.10.10.1", "1.1.1.1"],
        },
        eth4: {
          name: "eth4",
          dhcp: false,
          optional: true,
          ipAddress: "10.10.11.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.11.1",
          dns: ["10.10.11.1", "1.1.1.1"],
        },
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not update interfaces and return null - if dhcp is true and gateway is not a string", async () => {
      newPayload = {
        eth2: { name: "eth2", dhcp: true, optional: true },
        eth3: {
          name: "eth3",
          dhcp: true,
          optional: false,
          ipAddress: "10.10.10.2",
          subnetMask: "255.255.255.0",
          gateway: 1234,
          dns: ["10.10.10.1", "1.1.1.1"],
        },
        eth4: {
          name: "eth4",
          dhcp: false,
          optional: true,
          ipAddress: "10.10.11.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.11.1",
          dns: ["10.10.11.1", "1.1.1.1"],
        },
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not update interfaces and return null - if dhcp is true and ipAddress is not a valid ipAddress", async () => {
      newPayload = {
        eth2: { name: "eth2", dhcp: true, optional: true },
        eth3: {
          name: "eth3",
          dhcp: true,
          optional: false,
          ipAddress: "10.10.10.2",
          subnetMask: "255.255.255.0",
          gateway: "fakeIP",
          dns: ["10.10.10.1", "1.1.1.1"],
        },
        eth4: {
          name: "eth4",
          dhcp: false,
          optional: true,
          ipAddress: "10.10.11.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.11.1",
          dns: ["10.10.11.1", "1.1.1.1"],
        },
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not update interfaces and return null - if dhcp is true and ipAddress is ipAddress with CIDR", async () => {
      newPayload = {
        eth2: { name: "eth2", dhcp: true, optional: true },
        eth3: {
          name: "eth3",
          dhcp: true,
          optional: false,
          ipAddress: "10.10.10.2/24",
          subnetMask: "255.255.255.0",
          gateway: "10.10.10.1",
          dns: ["10.10.10.1", "1.1.1.1"],
        },
        eth4: {
          name: "eth4",
          dhcp: false,
          optional: true,
          ipAddress: "10.10.11.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.11.1",
          dns: ["10.10.11.1", "1.1.1.1"],
        },
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not update interfaces and return null - if dhcp is false and there is no dns", async () => {
      newPayload = {
        eth2: { name: "eth2", dhcp: true, optional: true },
        eth3: {
          name: "eth3",
          dhcp: false,
          optional: false,
          ipAddress: "10.10.10.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.10.1",
        },
        eth4: {
          name: "eth4",
          dhcp: false,
          optional: true,
          ipAddress: "10.10.11.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.11.1",
          dns: ["10.10.11.1", "1.1.1.1"],
        },
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should update interfaces and return new netplan interfaces configuration object - if dns is empty array", async () => {
      newPayload = {
        eth2: { name: "eth2", dhcp: true, optional: true },
        eth3: {
          name: "eth3",
          dhcp: false,
          optional: false,
          ipAddress: "10.10.10.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.10.1",
          dns: [],
        },
        eth4: {
          name: "eth4",
          dhcp: false,
          optional: true,
          ipAddress: "10.10.11.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.11.1",
          dns: ["10.10.11.1", "1.1.1.1"],
        },
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(newPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(newPayload);
    });

    it("should not update interfaces and return null - if dhcp is false and dns is null", async () => {
      newPayload = {
        eth2: { name: "eth2", dhcp: true, optional: true },
        eth3: {
          name: "eth3",
          dhcp: false,
          optional: false,
          ipAddress: "10.10.10.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.10.1",
          dns: null,
        },
        eth4: {
          name: "eth4",
          dhcp: false,
          optional: true,
          ipAddress: "10.10.11.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.11.1",
          dns: ["10.10.11.1", "1.1.1.1"],
        },
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not update interfaces and return null - if dhcp is false and dns is not and array", async () => {
      newPayload = {
        eth2: { name: "eth2", dhcp: true, optional: true },
        eth3: {
          name: "eth3",
          dhcp: false,
          optional: false,
          ipAddress: "10.10.10.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.10.1",
          dns: "fakeDNS",
        },
        eth4: {
          name: "eth4",
          dhcp: false,
          optional: true,
          ipAddress: "10.10.11.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.11.1",
          dns: ["10.10.11.1", "1.1.1.1"],
        },
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not update interfaces and return null - if dhcp is false and one of dns is null", async () => {
      newPayload = {
        eth2: { name: "eth2", dhcp: true, optional: true },
        eth3: {
          name: "eth3",
          dhcp: false,
          optional: false,
          ipAddress: "10.10.10.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.10.1",
          dns: ["10.10.10.1", null],
        },
        eth4: {
          name: "eth4",
          dhcp: false,
          optional: true,
          ipAddress: "10.10.11.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.11.1",
          dns: ["10.10.11.1", "1.1.1.1"],
        },
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not update interfaces and return null - if dhcp is false and one of dns is not a string", async () => {
      newPayload = {
        eth2: { name: "eth2", dhcp: true, optional: true },
        eth3: {
          name: "eth3",
          dhcp: false,
          optional: false,
          ipAddress: "10.10.10.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.10.1",
          dns: ["10.10.10.1", 1234],
        },
        eth4: {
          name: "eth4",
          dhcp: false,
          optional: true,
          ipAddress: "10.10.11.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.11.1",
          dns: ["10.10.11.1", "1.1.1.1"],
        },
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not update interfaces and return null - if dhcp is false and one of dns is not a valid ipAddress", async () => {
      newPayload = {
        eth2: { name: "eth2", dhcp: true, optional: true },
        eth3: {
          name: "eth3",
          dhcp: false,
          optional: false,
          ipAddress: "10.10.10.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.10.1",
          dns: ["10.10.10.1", "fakeIP"],
        },
        eth4: {
          name: "eth4",
          dhcp: false,
          optional: true,
          ipAddress: "10.10.11.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.11.1",
          dns: ["10.10.11.1", "1.1.1.1"],
        },
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not update interfaces and return null - if dhcp is false and one of dns is ipAddress with CIDR", async () => {
      newPayload = {
        eth2: { name: "eth2", dhcp: true, optional: true },
        eth3: {
          name: "eth3",
          dhcp: false,
          optional: false,
          ipAddress: "10.10.10.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.10.1",
          dns: ["10.10.10.1", "1.1.1.1/24"],
        },
        eth4: {
          name: "eth4",
          dhcp: false,
          optional: true,
          ipAddress: "10.10.11.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.11.1",
          dns: ["10.10.11.1", "1.1.1.1"],
        },
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not update interfaces and return null - if dhcp is true and dns is null", async () => {
      newPayload = {
        eth2: { name: "eth2", dhcp: true, optional: true },
        eth3: {
          name: "eth3",
          dhcp: true,
          optional: false,
          ipAddress: "10.10.10.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.10.1",
          dns: null,
        },
        eth4: {
          name: "eth4",
          dhcp: false,
          optional: true,
          ipAddress: "10.10.11.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.11.1",
          dns: ["10.10.11.1", "1.1.1.1"],
        },
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not update interfaces and return null - if dhcp is true and dns is not and array", async () => {
      newPayload = {
        eth2: { name: "eth2", dhcp: true, optional: true },
        eth3: {
          name: "eth3",
          dhcp: true,
          optional: false,
          ipAddress: "10.10.10.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.10.1",
          dns: "fakeDNS",
        },
        eth4: {
          name: "eth4",
          dhcp: false,
          optional: true,
          ipAddress: "10.10.11.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.11.1",
          dns: ["10.10.11.1", "1.1.1.1"],
        },
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not update interfaces and return null - if dhcp is true and one of dns is null", async () => {
      newPayload = {
        eth2: { name: "eth2", dhcp: true, optional: true },
        eth3: {
          name: "eth3",
          dhcp: true,
          optional: false,
          ipAddress: "10.10.10.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.10.1",
          dns: ["10.10.10.1", null],
        },
        eth4: {
          name: "eth4",
          dhcp: false,
          optional: true,
          ipAddress: "10.10.11.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.11.1",
          dns: ["10.10.11.1", "1.1.1.1"],
        },
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not update interfaces and return null - if dhcp is true and one of dns is not a string", async () => {
      newPayload = {
        eth2: { name: "eth2", dhcp: true, optional: true },
        eth3: {
          name: "eth3",
          dhcp: true,
          optional: false,
          ipAddress: "10.10.10.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.10.1",
          dns: ["10.10.10.1", 1234],
        },
        eth4: {
          name: "eth4",
          dhcp: false,
          optional: true,
          ipAddress: "10.10.11.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.11.1",
          dns: ["10.10.11.1", "1.1.1.1"],
        },
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not update interfaces and return null - if dhcp is true and one of dns is not a valid ipAddress", async () => {
      newPayload = {
        eth2: { name: "eth2", dhcp: true, optional: true },
        eth3: {
          name: "eth3",
          dhcp: true,
          optional: false,
          ipAddress: "10.10.10.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.10.1",
          dns: ["10.10.10.1", "fakeIP"],
        },
        eth4: {
          name: "eth4",
          dhcp: false,
          optional: true,
          ipAddress: "10.10.11.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.11.1",
          dns: ["10.10.11.1", "1.1.1.1"],
        },
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not update interfaces and return null - if dhcp is true and one of dns is ipAddress with CIDR", async () => {
      newPayload = {
        eth2: { name: "eth2", dhcp: true, optional: true },
        eth3: {
          name: "eth3",
          dhcp: true,
          optional: false,
          ipAddress: "10.10.10.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.10.1",
          dns: ["10.10.10.1", "1.1.1.1/24"],
        },
        eth4: {
          name: "eth4",
          dhcp: false,
          optional: true,
          ipAddress: "10.10.11.2",
          subnetMask: "255.255.255.0",
          gateway: "10.10.11.1",
          dns: ["10.10.11.1", "1.1.1.1"],
        },
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not throw and return null - if server app is not initialized", async () => {
      runServer = false;

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not throw and return null - if client was not initialized", async () => {
      initClient = false;

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not throw update interfaces and return it - if netplan file was not initially created", async () => {
      createInitialNetplanFile = false;

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(newPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(newPayload);
    });

    it("should not throw and return null - if token is invalid", async () => {
      clientToken = "fakeId";

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not throw and return null - if token is null", async () => {
      clientToken = null;

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not throw and return null - if token is undefined", async () => {
      clientToken = undefined;

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });
  });

  describe("setInterface", () => {
    let headers;
    let clientSocket;
    let clientToken;
    let initClient;
    let interfaceName;
    let newPayload;
    let initialPayload;

    beforeEach(() => {
      clientSocket = socketFilePath;
      clientToken = appAuthToken;
      initClient = true;
      interfaceName = "eth2";
      newPayload = {
        name: "eth2",
        dhcp: false,
        optional: true,
        ipAddress: "11.10.10.2",
        subnetMask: "255.255.0.0",
        gateway: "11.10.10.1",
        dns: ["11.10.10.1", "2.2.2.2"],
      };
    });

    let exec = async () => {
      await initApp();
      if (initClient)
        await netplanClientService.init(clientSocket, clientToken);

      initialPayload = await netplanClientService.getInterfaces();
      return netplanClientService.setInterface(interfaceName, newPayload);
    };

    it("should update interface and return new netplan interfaces configuration object", async () => {
      let result = await exec();

      expect(result).toBeDefined();
      expect(result).toEqual(newPayload);

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      //Copying object
      let expectedPayload = JSON.parse(JSON.stringify(initialPayload));
      expectedPayload[interfaceName] = newPayload;

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(expectedPayload);
    });

    it("should update interface and return new netplan interfaces configuration object - if gateway is set to 0.0.0.0", async () => {
      newPayload = {
        name: "eth2",
        dhcp: false,
        optional: true,
        ipAddress: "11.10.10.2",
        subnetMask: "255.255.0.0",
        gateway: "0.0.0.0",
        dns: ["11.10.10.1", "2.2.2.2"],
      };

      let result = await exec();

      expect(result).toBeDefined();
      expect(result).toEqual(newPayload);

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      //Copying object
      let expectedPayload = JSON.parse(JSON.stringify(initialPayload));
      expectedPayload[interfaceName] = newPayload;

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(expectedPayload);
    });

    it("should not update interface and return null - even if new interface config is empty", async () => {
      newPayload = {};

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not update interfaces and return null - if there are no interfaces at the begining (attempt to create new interface)", async () => {
      initialNetplanFileContentJSON.network.ethernets = {};

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should update interface and return new netplan interfaces configuration object - if interface has dhcp set to true but other network params set to static", async () => {
      newPayload = newPayload = {
        name: "eth2",
        dhcp: true,
        optional: true,
        ipAddress: "11.10.10.2",
        subnetMask: "255.255.0.0",
        gateway: "11.10.10.1",
        dns: ["11.10.10.1", "2.2.2.2"],
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      let expectedPayload = {
        ...initialPayload,
        eth2: { name: "eth2", dhcp: true, optional: true },
      };

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(expectedPayload);

      expect(result).toBeDefined();
      expect(result).toEqual({ name: "eth2", dhcp: true, optional: true });
    });

    it("should not update interfaces and return null - if there is no interface of given name", async () => {
      newPayload = {
        name: "eth3",
        dhcp: false,
        optional: true,
        ipAddress: "11.10.10.2",
        subnetMask: "255.255.0.0",
        gateway: "11.10.10.1",
        dns: ["11.10.10.1", "2.2.2.2"],
      };
      interfaceName = "eth3";

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not update interfaces and return null - if name of interface is not given", async () => {
      newPayload = {
        dhcp: false,
        optional: true,
        ipAddress: "11.10.10.2",
        subnetMask: "255.255.0.0",
        gateway: "11.10.10.1",
        dns: ["11.10.10.1", "2.2.2.2"],
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not update interfaces and return null - if name of interface is null", async () => {
      newPayload = {
        name: null,
        dhcp: false,
        optional: true,
        ipAddress: "11.10.10.2",
        subnetMask: "255.255.0.0",
        gateway: "11.10.10.1",
        dns: ["11.10.10.1", "2.2.2.2"],
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not update interfaces and return null - if name of interface is not a string", async () => {
      newPayload = {
        name: 1234,
        dhcp: false,
        optional: true,
        ipAddress: "11.10.10.2",
        subnetMask: "255.255.0.0",
        gateway: "11.10.10.1",
        dns: ["11.10.10.1", "2.2.2.2"],
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not update interfaces and return null - if name of interface is not the same name as in key", async () => {
      newPayload = {
        name: "eth5",
        dhcp: false,
        optional: true,
        ipAddress: "11.10.10.2",
        subnetMask: "255.255.0.0",
        gateway: "11.10.10.1",
        dns: ["11.10.10.1", "2.2.2.2"],
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not update interfaces and return null - if name of interface is not the same name as in key, but there is an interface with name from config object", async () => {
      newPayload = {
        name: "eth1",
        dhcp: false,
        optional: true,
        ipAddress: "11.10.10.2",
        subnetMask: "255.255.0.0",
        gateway: "11.10.10.1",
        dns: ["11.10.10.1", "2.2.2.2"],
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not update interfaces and return null - if optional of  is not given", async () => {
      newPayload = {
        name: "eth2",
        dhcp: false,
        ipAddress: "10.10.10.2",
        subnetMask: "255.255.255.0",
        gateway: "10.10.10.1",
        dns: ["10.10.10.1", "1.1.1.1"],
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not update interfaces and return null - if optional of interface is null", async () => {
      newPayload = {
        name: "eth2",
        dhcp: false,
        optional: null,
        ipAddress: "10.10.10.2",
        subnetMask: "255.255.255.0",
        gateway: "10.10.10.1",
        dns: ["10.10.10.1", "1.1.1.1"],
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not update interfaces and return null - if optional of interface is not a boolean", async () => {
      newPayload = {
        name: "eth2",
        dhcp: false,
        optional: 1234,
        ipAddress: "10.10.10.2",
        subnetMask: "255.255.255.0",
        gateway: "10.10.10.1",
        dns: ["10.10.10.1", "1.1.1.1"],
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not update interfaces and return null - if dhcp is not given", async () => {
      newPayload = {
        optional: false,
        name: "eth2",
        ipAddress: "10.10.10.2",
        subnetMask: "255.255.255.0",
        gateway: "10.10.10.1",
        dns: ["10.10.10.1", "1.1.1.1"],
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not update interfaces and return null - if dhcp of interface is null", async () => {
      newPayload = {
        name: "eth2",
        dhcp: null,
        optional: false,
        ipAddress: "10.10.10.2",
        subnetMask: "255.255.255.0",
        gateway: "10.10.10.1",
        dns: ["10.10.10.1", "1.1.1.1"],
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not update interfaces and return null - if dhcp of interface is not a boolean", async () => {
      newPayload = {
        name: "eth2",
        dhcp: 1234,
        optional: false,
        ipAddress: "10.10.10.2",
        subnetMask: "255.255.255.0",
        gateway: "10.10.10.1",
        dns: ["10.10.10.1", "1.1.1.1"],
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not update interfaces and return null - if dhcp is false and there is no ipAddress", async () => {
      newPayload = {
        name: "eth2",
        dhcp: false,
        optional: false,
        subnetMask: "255.255.255.0",
        gateway: "10.10.10.1",
        dns: ["10.10.10.1", "1.1.1.1"],
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not update interfaces and return null - if dhcp is false and ipAddress is null", async () => {
      newPayload = {
        name: "eth2",
        dhcp: false,
        optional: false,
        ipAddress: null,
        subnetMask: "255.255.255.0",
        gateway: "10.10.10.1",
        dns: ["10.10.10.1", "1.1.1.1"],
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not update interfaces and return null - if dhcp is false and ipAddress is not a string", async () => {
      newPayload = {
        name: "eth2",
        dhcp: false,
        optional: false,
        ipAddress: 1234,
        subnetMask: "255.255.255.0",
        gateway: "10.10.10.1",
        dns: ["10.10.10.1", "1.1.1.1"],
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not update interfaces and return null - if dhcp is false and ipAddress is not a valid ipAddress", async () => {
      newPayload = {
        name: "eth2",
        dhcp: false,
        optional: false,
        ipAddress: "fakeIP",
        subnetMask: "255.255.255.0",
        gateway: "10.10.10.1",
        dns: ["10.10.10.1", "1.1.1.1"],
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not update interfaces and return null - if dhcp is false and ipAddress is ipAddress with CIDR", async () => {
      newPayload = {
        name: "eth2",
        dhcp: false,
        optional: false,
        ipAddress: "10.10.10.2/24",
        subnetMask: "255.255.255.0",
        gateway: "10.10.10.1",
        dns: ["10.10.10.1", "1.1.1.1"],
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not update interfaces and return null - if dhcp is true and ipAddress is null", async () => {
      newPayload = {
        name: "eth2",
        dhcp: true,
        optional: false,
        ipAddress: null,
        subnetMask: "255.255.255.0",
        gateway: "10.10.10.1",
        dns: ["10.10.10.1", "1.1.1.1"],
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not update interfaces and return null - if dhcp is true and ipAddress is not a string", async () => {
      newPayload = {
        name: "eth2",
        dhcp: true,
        optional: false,
        ipAddress: 1234,
        subnetMask: "255.255.255.0",
        gateway: "10.10.10.1",
        dns: ["10.10.10.1", "1.1.1.1"],
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not update interfaces and return null - if dhcp is true and ipAddress is not a valid ipAddress", async () => {
      newPayload = {
        name: "eth2",
        dhcp: true,
        optional: false,
        ipAddress: "fakeIP",
        subnetMask: "255.255.255.0",
        gateway: "10.10.10.1",
        dns: ["10.10.10.1", "1.1.1.1"],
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not update interfaces and return null - if dhcp is true and ipAddress is ipAddress with CIDR", async () => {
      newPayload = {
        name: "eth2",
        dhcp: true,
        optional: false,
        ipAddress: "10.10.10.2/24",
        subnetMask: "255.255.255.0",
        gateway: "10.10.10.1",
        dns: ["10.10.10.1", "1.1.1.1"],
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not update interfaces and return null - if dhcp is false and there is no subnetMask", async () => {
      newPayload = {
        name: "eth2",
        dhcp: false,
        optional: false,
        ipAddress: "10.10.10.2",
        gateway: "10.10.10.1",
        dns: ["10.10.10.1", "1.1.1.1"],
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not update interfaces and return null - if dhcp is false and subnetMask is null", async () => {
      newPayload = {
        name: "eth2",
        dhcp: false,
        optional: false,
        ipAddress: "10.10.10.2",
        subnetMask: null,
        gateway: "10.10.10.1",
        dns: ["10.10.10.1", "1.1.1.1"],
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not update interfaces and return null - if dhcp is false and subnetMask is not a string", async () => {
      newPayload = {
        name: "eth2",
        dhcp: false,
        optional: false,
        ipAddress: "10.10.10.2",
        subnetMask: 1234,
        gateway: "10.10.10.1",
        dns: ["10.10.10.1", "1.1.1.1"],
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not update interfaces and return null - if dhcp is false and subnetMask is not a valid ipAddress", async () => {
      newPayload = {
        name: "eth2",
        dhcp: false,
        optional: false,
        ipAddress: "10.10.10.2",
        subnetMask: "fakeIP",
        gateway: "10.10.10.1",
        dns: ["10.10.10.1", "1.1.1.1"],
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not update interfaces and return null - if dhcp is false and subnetMask is ipAddress with CIDR", async () => {
      newPayload = {
        name: "eth2",
        dhcp: false,
        optional: false,
        ipAddress: "10.10.10.2",
        subnetMask: "255.255.255.0/24",
        gateway: "10.10.10.1",
        dns: ["10.10.10.1", "1.1.1.1"],
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not update interfaces and return null - if dhcp is true and subnetMask is null", async () => {
      newPayload = {
        name: "eth2",
        dhcp: true,
        optional: false,
        ipAddress: "10.10.10.2",
        subnetMask: null,
        gateway: "10.10.10.1",
        dns: ["10.10.10.1", "1.1.1.1"],
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not update interfaces and return null - if dhcp is true and subnetMask is not a string", async () => {
      newPayload = {
        name: "eth2",
        dhcp: true,
        optional: false,
        ipAddress: "10.10.10.2",
        subnetMask: 1234,
        gateway: "10.10.10.1",
        dns: ["10.10.10.1", "1.1.1.1"],
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not update interfaces and return null - if dhcp is true and subnetMask is not a valid ipAddress", async () => {
      newPayload = {
        name: "eth2",
        dhcp: true,
        optional: false,
        ipAddress: "10.10.10.2",
        subnetMask: "fakeIP",
        gateway: "10.10.10.1",
        dns: ["10.10.10.1", "1.1.1.1"],
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not update interfaces and return null - if dhcp is true and subnetMask is ipAddress with CIDR", async () => {
      newPayload = {
        name: "eth2",
        dhcp: true,
        optional: false,
        ipAddress: "10.10.10.2",
        subnetMask: "255.255.255.0/24",
        gateway: "10.10.10.1",
        dns: ["10.10.10.1", "1.1.1.1"],
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not update interfaces and return null - if dhcp is false and there is no gateway", async () => {
      newPayload = {
        name: "eth2",
        dhcp: false,
        optional: false,
        ipAddress: "10.10.10.2",
        subnetMask: "255.255.255.0",
        dns: ["10.10.10.1", "1.1.1.1"],
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not update interfaces and return null - if dhcp is false and gateway is null", async () => {
      newPayload = {
        name: "eth2",
        dhcp: false,
        optional: false,
        ipAddress: "10.10.10.2",
        subnetMask: "255.255.255.0",
        gateway: null,
        dns: ["10.10.10.1", "1.1.1.1"],
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not update interfaces and return null - if dhcp is false and gateway is not a string", async () => {
      newPayload = {
        name: "eth2",
        dhcp: false,
        optional: false,
        ipAddress: "10.10.10.2",
        subnetMask: "255.255.255.0",
        gateway: 1234,
        dns: ["10.10.10.1", "1.1.1.1"],
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not update interfaces and return null - if dhcp is false and gateway is not a valid ipAddress", async () => {
      newPayload = {
        name: "eth2",
        dhcp: false,
        optional: false,
        ipAddress: "10.10.10.2",
        subnetMask: "255.255.255.0",
        gateway: "fakeIP",
        dns: ["10.10.10.1", "1.1.1.1"],
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not update interfaces and return null - if dhcp is false and gateway is ipAddress with CIDR", async () => {
      newPayload = {
        name: "eth2",
        dhcp: false,
        optional: false,
        ipAddress: "10.10.10.2",
        subnetMask: "255.255.255.0",
        gateway: "10.10.10.1/24",
        dns: ["10.10.10.1", "1.1.1.1"],
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not update interfaces and return null - if dhcp is true and gateway is null", async () => {
      newPayload = {
        name: "eth2",
        dhcp: true,
        optional: false,
        ipAddress: "10.10.10.2",
        subnetMask: "255.255.255.0",
        gateway: null,
        dns: ["10.10.10.1", "1.1.1.1"],
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not update interfaces and return null - if dhcp is true and gateway is not a string", async () => {
      newPayload = {
        name: "eth2",
        dhcp: true,
        optional: false,
        ipAddress: "10.10.10.2",
        subnetMask: "255.255.255.0",
        gateway: 1234,
        dns: ["10.10.10.1", "1.1.1.1"],
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not update interfaces and return null - if dhcp is true and gateway is not a valid ipAddress", async () => {
      newPayload = {
        name: "eth2",
        dhcp: true,
        optional: false,
        ipAddress: "10.10.10.2",
        subnetMask: "255.255.255.0",
        gateway: "fakeIP",
        dns: ["10.10.10.1", "1.1.1.1"],
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not update interfaces and return null - if dhcp is true and gateway is ipAddress with CIDR", async () => {
      newPayload = {
        name: "eth2",
        dhcp: true,
        optional: false,
        ipAddress: "10.10.10.2",
        subnetMask: "255.255.255.0",
        gateway: "10.10.10.1/24",
        dns: ["10.10.10.1", "1.1.1.1"],
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not update interfaces and return null - if dhcp is false and there is no dns", async () => {
      newPayload = {
        name: "eth2",
        dhcp: false,
        optional: false,
        ipAddress: "10.10.10.2",
        subnetMask: "255.255.255.0",
        gateway: "10.10.10.1",
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should update interfaces and return new netplan interfaces configuration object - if dns is empty array", async () => {
      newPayload = {
        name: "eth2",
        dhcp: false,
        optional: false,
        ipAddress: "10.10.10.2",
        subnetMask: "255.255.255.0",
        gateway: "10.10.10.1",
        dns: [],
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      let expectedPayload = {
        ...initialPayload,
        [newPayload.name]: newPayload,
      };
      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(expectedPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(newPayload);
    });

    it("should not update interfaces and return null - if dhcp is false and dns is null", async () => {
      newPayload = {
        name: "eth2",
        dhcp: false,
        optional: false,
        ipAddress: "10.10.10.2",
        subnetMask: "255.255.255.0",
        gateway: "10.10.10.1",
        dns: null,
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not update interfaces and return null - if dhcp is false and dns is not and array", async () => {
      newPayload = {
        name: "eth2",
        dhcp: false,
        optional: false,
        ipAddress: "10.10.10.2",
        subnetMask: "255.255.255.0",
        gateway: "10.10.10.1",
        dns: "fakeDNS",
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not update interfaces and return null - if dhcp is false and one of dns is null", async () => {
      newPayload = {
        name: "eth2",
        dhcp: false,
        optional: false,
        ipAddress: "10.10.10.2",
        subnetMask: "255.255.255.0",
        gateway: "10.10.10.1",
        dns: ["10.10.10.1", null],
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not update interfaces and return null - if dhcp is false and one of dns is not a string", async () => {
      newPayload = {
        name: "eth2",
        dhcp: false,
        optional: false,
        ipAddress: "10.10.10.2",
        subnetMask: "255.255.255.0",
        gateway: "10.10.10.1",
        dns: ["10.10.10.1", 1234],
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not update interfaces and return null - if dhcp is false and one of dns is not a valid ipAddress", async () => {
      newPayload = {
        name: "eth2",
        dhcp: false,
        optional: false,
        ipAddress: "10.10.10.2",
        subnetMask: "255.255.255.0",
        gateway: "10.10.10.1",
        dns: ["10.10.10.1", "fakeIP"],
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not update interfaces and return null - if dhcp is false and one of dns is ipAddress with CIDR", async () => {
      newPayload = {
        name: "eth2",
        dhcp: false,
        optional: false,
        ipAddress: "10.10.10.2",
        subnetMask: "255.255.255.0",
        gateway: "10.10.10.1",
        dns: ["10.10.10.1", "1.1.1.1/24"],
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not update interfaces and return null - if dhcp is true and dns is null", async () => {
      newPayload = {
        name: "eth2",
        dhcp: true,
        optional: false,
        ipAddress: "10.10.10.2",
        subnetMask: "255.255.255.0",
        gateway: "10.10.10.1",
        dns: null,
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not update interfaces and return null - if dhcp is true and dns is not and array", async () => {
      newPayload = {
        name: "eth2",
        dhcp: true,
        optional: false,
        ipAddress: "10.10.10.2",
        subnetMask: "255.255.255.0",
        gateway: "10.10.10.1",
        dns: "fakeDNS",
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not update interfaces and return null - if dhcp is true and one of dns is null", async () => {
      newPayload = {
        name: "eth2",
        dhcp: true,
        optional: false,
        ipAddress: "10.10.10.2",
        subnetMask: "255.255.255.0",
        gateway: "10.10.10.1",
        dns: ["10.10.10.1", null],
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not update interfaces and return null - if dhcp is true and one of dns is not a string", async () => {
      newPayload = {
        name: "eth2",
        dhcp: true,
        optional: false,
        ipAddress: "10.10.10.2",
        subnetMask: "255.255.255.0",
        gateway: "10.10.10.1",
        dns: ["10.10.10.1", 1234],
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not update interfaces and return null - if dhcp is true and one of dns is not a valid ipAddress", async () => {
      newPayload = {
        name: "eth2",
        dhcp: true,
        optional: false,
        ipAddress: "10.10.10.2",
        subnetMask: "255.255.255.0",
        gateway: "10.10.10.1",
        dns: ["10.10.10.1", "fakeIP"],
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not update interfaces and return null - if dhcp is true and one of dns is ipAddress with CIDR", async () => {
      newPayload = {
        name: "eth2",
        dhcp: true,
        optional: false,
        ipAddress: "10.10.10.2",
        subnetMask: "255.255.255.0",
        gateway: "10.10.10.1",
        dns: ["10.10.10.1", "1.1.1.1/24"],
      };

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not throw and return null - if server app is not initialized", async () => {
      runServer = false;

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not throw and return null - if client was not initialized", async () => {
      initClient = false;

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not throw and return null - if token is invalid", async () => {
      clientToken = "fakeId";

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not throw and return null - if token is null", async () => {
      clientToken = null;

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });

    it("should not throw and return null - if token is undefined", async () => {
      clientToken = undefined;

      let result = await exec();

      let actualInterfaceConfig = await netplanClientService.getInterfaces();

      expect(actualInterfaceConfig).toBeDefined();
      expect(actualInterfaceConfig).toEqual(initialPayload);

      expect(result).toBeDefined();
      expect(result).toEqual(null);
    });
  });
});
