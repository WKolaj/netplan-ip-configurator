const path = require("path");
const config = require("config");

//mocking child_process exec
const child_proccess = require("child_process");
const mockExec = jest.fn();
child_proccess.exec = (command, callback) => {
  mockExec(command);
  callback();
};

const {
  clearDirectoryAsync,
  writeFileAsync,
  convertJSONToYaml,
  convertYamlToJSON,
  removeFileOrDirectoryAsync,
  readFileAsync,
  snooze,
} = require("../../utilities/utilities");
const netplanDirPathFromConfig = config.get("netplanDirPath");
const netplanFileNameFromConfig = config.get("netplanFileName");
const netplanFilePath = path.join(
  netplanDirPathFromConfig,
  netplanFileNameFromConfig
);
const {
  NetplanConfigurator,
} = require("../../classes/NetplanConfigurator/NetplanConfigurator");

describe("NetplanConfigurator", () => {
  beforeEach(async () => {
    //Clear fake netplan dir
    await clearDirectoryAsync(netplanDirPathFromConfig);
  });

  describe("constructor", () => {
    let netplanDirPath;
    let netplanFileName;

    beforeEach(() => {
      netplanDirPath = "TestNetplanDirPath";
      netplanFileName = "TestNetplanFilePath";
    });

    let exec = () => {
      return new NetplanConfigurator(netplanDirPath, netplanFileName);
    };

    it("should create new NetplanConfigurator and assign its properties", () => {
      let result = exec();

      expect(result).toBeDefined();
      expect(result.DirPath).toEqual(netplanDirPath);
      expect(result.FileName).toEqual(netplanFileName);
      expect(result.Interfaces).toEqual({});
    });

    it("should assign dirName and dirPath as default netplan paths if they were not specified in payload", () => {
      netplanDirPath = undefined;
      netplanFileName = undefined;

      let result = exec();

      expect(result).toBeDefined();
      expect(result.DirPath).toEqual("/etc/netplan");
      expect(result.FileName).toEqual("00-installer-config.yaml");
    });
  });

  describe("Load", () => {
    let jsonFileContent;
    let fileContent;
    let neplanConfigurator;
    let createFile;
    let dirPath;
    let fileName;

    beforeEach(() => {
      jsonFileContent = {
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

      fileContent = null;
      createFile = true;

      dirPath = netplanDirPathFromConfig;
      fileName = netplanFileNameFromConfig;
    });

    let exec = async () => {
      if (!fileContent) {
        fileContent = convertJSONToYaml(jsonFileContent);
      }

      if (createFile)
        await writeFileAsync(path.join(dirPath, fileName), fileContent, "utf8");

      neplanConfigurator = new NetplanConfigurator(dirPath, fileName);

      return neplanConfigurator.Load();
    };

    it("should load netplan file - if every option exists", async () => {
      await exec();

      let expectedPayload = {
        dirPath: netplanDirPathFromConfig,
        fileName: netplanFileNameFromConfig,
        interfaces: [
          {
            name: "eth1",
            dhcp: true,
            optional: true,
          },
          {
            name: "eth2",
            dhcp: false,
            optional: false,
            ipAddress: "10.10.10.2",
            subnetMask: "255.255.255.0",
            gateway: "10.10.10.1",
            dns: ["10.10.10.1", "1.1.1.1"],
          },
        ],
      };

      expect(neplanConfigurator.Payload).toEqual(expectedPayload);
    });

    it("should load netplan file - if gateway is set to 0.0.0.0", async () => {
      jsonFileContent = {
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

      await exec();

      let expectedPayload = {
        dirPath: netplanDirPathFromConfig,
        fileName: netplanFileNameFromConfig,
        interfaces: [
          {
            name: "eth1",
            dhcp: true,
            optional: true,
          },
          {
            name: "eth2",
            dhcp: false,
            optional: false,
            ipAddress: "10.10.10.2",
            subnetMask: "255.255.255.0",
            gateway: "0.0.0.0",
            dns: ["10.10.10.1", "1.1.1.1"],
          },
        ],
      };

      expect(neplanConfigurator.Payload).toEqual(expectedPayload);
    });

    it("should load netplan file and set gateway to 0.0.0.0 - if gateway is not present in netplan file", async () => {
      jsonFileContent = {
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

      await exec();

      let expectedPayload = {
        dirPath: netplanDirPathFromConfig,
        fileName: netplanFileNameFromConfig,
        interfaces: [
          {
            name: "eth1",
            dhcp: true,
            optional: true,
          },
          {
            name: "eth2",
            dhcp: false,
            optional: false,
            ipAddress: "10.10.10.2",
            subnetMask: "255.255.255.0",
            gateway: "0.0.0.0",
            dns: ["10.10.10.1", "1.1.1.1"],
          },
        ],
      };

      expect(neplanConfigurator.Payload).toEqual(expectedPayload);
    });

    it("should load netplan file and not set gateway to 0.0.0.0 - if gateway is not present in netplan file but dhcp is true", async () => {
      jsonFileContent = {
        network: {
          version: 2,
          ethernets: {
            eth1: {
              dhcp4: true,
              optional: true,
            },
            eth2: {
              dhcp4: true,
              optional: true,
            },
          },
        },
      };

      await exec();

      let expectedPayload = {
        dirPath: netplanDirPathFromConfig,
        fileName: netplanFileNameFromConfig,
        interfaces: [
          {
            name: "eth1",
            dhcp: true,
            optional: true,
          },
          {
            name: "eth2",
            dhcp: true,
            optional: true,
          },
        ],
      };

      expect(neplanConfigurator.Payload).toEqual(expectedPayload);
    });

    it("should load netplan file and not set gateway to 0.0.0.0 - if gateway is present in netplan file but dhcp is true", async () => {
      jsonFileContent = {
        network: {
          version: 2,
          ethernets: {
            eth1: {
              dhcp4: true,
              optional: true,
            },
            eth2: {
              dhcp4: true,
              optional: true,
              gateway4: "1.1.1.1",
            },
          },
        },
      };

      await exec();

      let expectedPayload = {
        dirPath: netplanDirPathFromConfig,
        fileName: netplanFileNameFromConfig,
        interfaces: [
          {
            name: "eth1",
            dhcp: true,
            optional: true,
          },
          {
            name: "eth2",
            dhcp: true,
            optional: true,
          },
        ],
      };

      expect(neplanConfigurator.Payload).toEqual(expectedPayload);
    });

    it("should load netplan file - if there is no interface", async () => {
      jsonFileContent = {
        network: {
          version: 2,
          ethernets: {},
        },
      };

      await exec();

      let expectedPayload = {
        dirPath: netplanDirPathFromConfig,
        fileName: netplanFileNameFromConfig,
        interfaces: [],
      };

      expect(neplanConfigurator.Payload).toEqual(expectedPayload);
    });

    it("should load netplan file - if there is only one interface", async () => {
      jsonFileContent = {
        network: {
          version: 2,
          ethernets: {
            eth1: {
              addresses: ["10.10.10.2/24"],
              gateway4: "10.10.10.1",
              nameservers: { addresses: ["10.10.10.1", "1.1.1.1"] },
              optional: true,
            },
          },
        },
      };

      await exec();

      let expectedPayload = {
        dirPath: netplanDirPathFromConfig,
        fileName: netplanFileNameFromConfig,
        interfaces: [
          {
            name: "eth1",
            dhcp: false,
            optional: true,
            ipAddress: "10.10.10.2",
            subnetMask: "255.255.255.0",
            gateway: "10.10.10.1",
            dns: ["10.10.10.1", "1.1.1.1"],
          },
        ],
      };

      expect(neplanConfigurator.Payload).toEqual(expectedPayload);
    });

    it("should load netplan file and set optional to false - if optional flag does not exist", async () => {
      jsonFileContent = {
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
            },
          },
        },
      };

      await exec();

      let expectedPayload = {
        dirPath: netplanDirPathFromConfig,
        fileName: netplanFileNameFromConfig,
        interfaces: [
          {
            name: "eth1",
            dhcp: true,
            optional: true,
          },
          {
            name: "eth2",
            dhcp: false,
            optional: false,
            ipAddress: "10.10.10.2",
            subnetMask: "255.255.255.0",
            gateway: "10.10.10.1",
            dns: ["10.10.10.1", "1.1.1.1"],
          },
        ],
      };

      expect(neplanConfigurator.Payload).toEqual(expectedPayload);
    });

    it("should not throw but initilize empty interfaces - if file name is null", async () => {
      fileName = null;
      createFile = false;

      await exec();

      let expectedPayload = {
        dirPath: dirPath,
        fileName: fileName,
        interfaces: [],
      };

      expect(neplanConfigurator.Payload).toEqual(expectedPayload);
    });

    it("should not throw but initilize empty interfaces - if dirPath is null", async () => {
      dirPath = null;
      createFile = false;

      await exec();

      let expectedPayload = {
        dirPath: dirPath,
        fileName: fileName,
        interfaces: [],
      };

      expect(neplanConfigurator.Payload).toEqual(expectedPayload);
    });

    it("should not throw but initilize empty interfaces - if directory does not exists", async () => {
      dirPath = "fakeDir";
      createFile = false;

      await exec();

      let expectedPayload = {
        dirPath: dirPath,
        fileName: fileName,
        interfaces: [],
      };

      expect(neplanConfigurator.Payload).toEqual(expectedPayload);
    });

    it("should not throw but initilize empty interfaces - if file does not exists", async () => {
      createFile = false;

      await exec();

      let expectedPayload = {
        dirPath: netplanDirPathFromConfig,
        fileName: netplanFileNameFromConfig,
        interfaces: [],
      };

      expect(neplanConfigurator.Payload).toEqual(expectedPayload);
    });

    it("should not throw but initilize empty interfaces - if file is empty", async () => {
      createFile = false;
      await writeFileAsync(netplanFilePath, "");

      await exec();

      let expectedPayload = {
        dirPath: netplanDirPathFromConfig,
        fileName: netplanFileNameFromConfig,
        interfaces: [],
      };

      expect(neplanConfigurator.Payload).toEqual(expectedPayload);
    });

    it("should not throw but initilize empty interfaces - if file is corrupted - invalid yaml", async () => {
      fileContent = `fake yaml content
      due to the fact
      that it should be faked `;

      await exec();

      let expectedPayload = {
        dirPath: netplanDirPathFromConfig,
        fileName: netplanFileNameFromConfig,
        interfaces: [],
      };

      expect(neplanConfigurator.Payload).toEqual(expectedPayload);
    });

    it("should not throw but initilize - if file is corrupted - no version specified", async () => {
      jsonFileContent = {
        network: {
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

      await exec();

      let expectedPayload = {
        dirPath: netplanDirPathFromConfig,
        fileName: netplanFileNameFromConfig,
        interfaces: [
          {
            name: "eth1",
            dhcp: true,
            optional: true,
          },
          {
            name: "eth2",
            dhcp: false,
            optional: false,
            ipAddress: "10.10.10.2",
            subnetMask: "255.255.255.0",
            gateway: "10.10.10.1",
            dns: ["10.10.10.1", "1.1.1.1"],
          },
        ],
      };

      expect(neplanConfigurator.Payload).toEqual(expectedPayload);
    });

    it("should not throw but initilize - if file is corrupted - no ethernets specified", async () => {
      jsonFileContent = {
        network: {
          version: 2,
        },
      };

      await exec();

      let expectedPayload = {
        dirPath: netplanDirPathFromConfig,
        fileName: netplanFileNameFromConfig,
        interfaces: [],
      };

      expect(neplanConfigurator.Payload).toEqual(expectedPayload);
    });

    it("should not throw but initilize - if file is corrupted - ethernets is empty", async () => {
      jsonFileContent = {
        network: {
          ethernets: {},
        },
      };

      await exec();

      let expectedPayload = {
        dirPath: netplanDirPathFromConfig,
        fileName: netplanFileNameFromConfig,
        interfaces: [],
      };

      expect(neplanConfigurator.Payload).toEqual(expectedPayload);
    });

    it("should not throw but initilize - if file is corrupted - one of ethernets is empty", async () => {
      jsonFileContent = {
        network: {
          version: 2,
          ethernets: {
            eth1: {},
            eth2: {
              addresses: ["10.10.10.2/24"],
              gateway4: "10.10.10.1",
              nameservers: { addresses: ["10.10.10.1", "1.1.1.1"] },
              optional: false,
            },
          },
        },
      };

      await exec();

      let expectedPayload = {
        dirPath: netplanDirPathFromConfig,
        fileName: netplanFileNameFromConfig,
        interfaces: [
          {
            name: "eth1",
            dhcp: false,
            optional: false,
            ipAddress: "",
            subnetMask: "",
            gateway: "0.0.0.0",
            dns: [],
          },
          {
            name: "eth2",
            dhcp: false,
            optional: false,
            ipAddress: "10.10.10.2",
            subnetMask: "255.255.255.0",
            gateway: "10.10.10.1",
            dns: ["10.10.10.1", "1.1.1.1"],
          },
        ],
      };
      expect(neplanConfigurator.Payload).toEqual(expectedPayload);
    });

    it("should not throw but initilize - if file is corrupted - one of ethernets has dhcp specified as true together with static ip - dhcp true", async () => {
      jsonFileContent = {
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

      await exec();

      let expectedPayload = {
        dirPath: netplanDirPathFromConfig,
        fileName: netplanFileNameFromConfig,
        interfaces: [
          {
            name: "eth1",
            dhcp: true,
            optional: true,
          },
          {
            name: "eth2",
            dhcp: true,
            optional: false,
          },
        ],
      };

      expect(neplanConfigurator.Payload).toEqual(expectedPayload);
    });

    it("should not throw but initilize - if file is corrupted - one of ethernets has dhcp specified as true together with static ip - dhcp false", async () => {
      jsonFileContent = {
        network: {
          version: 2,
          ethernets: {
            eth1: {
              dhcp4: true,
              optional: true,
            },
            eth2: {
              dhcp4: false,
              addresses: ["10.10.10.2/24"],
              gateway4: "10.10.10.1",
              nameservers: { addresses: ["10.10.10.1", "1.1.1.1"] },
              optional: false,
            },
          },
        },
      };

      await exec();

      let expectedPayload = {
        dirPath: netplanDirPathFromConfig,
        fileName: netplanFileNameFromConfig,
        interfaces: [
          {
            name: "eth1",
            dhcp: true,
            optional: true,
          },
          {
            name: "eth2",
            dhcp: false,
            optional: false,
            ipAddress: "10.10.10.2",
            subnetMask: "255.255.255.0",
            gateway: "10.10.10.1",
            dns: ["10.10.10.1", "1.1.1.1"],
          },
        ],
      };

      expect(neplanConfigurator.Payload).toEqual(expectedPayload);
    });

    it("should not throw but initilize - if file is corrupted - one of ethernets has more than one ip address - (only first taken into account)", async () => {
      jsonFileContent = {
        network: {
          version: 2,
          ethernets: {
            eth1: {
              dhcp4: true,
              optional: true,
            },
            eth2: {
              dhcp4: false,
              addresses: ["10.10.10.2/24", "10.10.10.3/24"],
              gateway4: "10.10.10.1",
              nameservers: { addresses: ["10.10.10.1", "1.1.1.1"] },
              optional: false,
            },
          },
        },
      };

      await exec();

      let expectedPayload = {
        dirPath: netplanDirPathFromConfig,
        fileName: netplanFileNameFromConfig,
        interfaces: [
          {
            name: "eth1",
            dhcp: true,
            optional: true,
          },
          {
            name: "eth2",
            dhcp: false,
            optional: false,
            ipAddress: "10.10.10.2",
            subnetMask: "255.255.255.0",
            gateway: "10.10.10.1",
            dns: ["10.10.10.1", "1.1.1.1"],
          },
        ],
      };

      expect(neplanConfigurator.Payload).toEqual(expectedPayload);
    });

    it("should not throw but initilize - if file is corrupted - one of ethernets has invalid ip address", async () => {
      jsonFileContent = {
        network: {
          version: 2,
          ethernets: {
            eth1: {
              dhcp4: true,
              optional: true,
            },
            eth2: {
              dhcp4: false,
              addresses: ["10.10.10.2"],
              gateway4: "10.10.10.1",
              nameservers: { addresses: ["10.10.10.1", "1.1.1.1"] },
              optional: false,
            },
          },
        },
      };

      await exec();

      let expectedPayload = {
        dirPath: netplanDirPathFromConfig,
        fileName: netplanFileNameFromConfig,
        interfaces: [
          {
            name: "eth1",
            dhcp: true,
            optional: true,
          },
          {
            name: "eth2",
            dhcp: false,
            optional: false,
            ipAddress: "",
            subnetMask: "",
            gateway: "10.10.10.1",
            dns: ["10.10.10.1", "1.1.1.1"],
          },
        ],
      };

      expect(neplanConfigurator.Payload).toEqual(expectedPayload);
    });

    it("should not throw but initilize - if file is corrupted - one of ethernets has invalid gateway address", async () => {
      jsonFileContent = {
        network: {
          version: 2,
          ethernets: {
            eth1: {
              dhcp4: true,
              optional: true,
            },
            eth2: {
              dhcp4: false,
              addresses: ["10.10.10.2/24", "10.10.10.3/24"],
              gateway4: "",
              nameservers: { addresses: ["10.10.10.1", "1.1.1.1"] },
              optional: false,
            },
          },
        },
      };

      await exec();

      let expectedPayload = {
        dirPath: netplanDirPathFromConfig,
        fileName: netplanFileNameFromConfig,
        interfaces: [
          {
            name: "eth1",
            dhcp: true,
            optional: true,
          },
          {
            name: "eth2",
            dhcp: false,
            optional: false,
            ipAddress: "10.10.10.2",
            subnetMask: "255.255.255.0",
            gateway: "",
            dns: ["10.10.10.1", "1.1.1.1"],
          },
        ],
      };

      expect(neplanConfigurator.Payload).toEqual(expectedPayload);
    });

    it("should not throw but initilize - if file is corrupted - one of ethernets has more than one ip address - (additional parameters in JSON)", async () => {
      jsonFileContent = {
        network: {
          fake1: 1,
          version: 2,
          ethernets: {
            eth1: {
              dhcp4: true,
              optional: true,
              fake2: 2,
            },
            eth2: {
              dhcp4: false,
              addresses: ["10.10.10.2/24"],
              gateway4: "10.10.10.1",
              nameservers: { addresses: ["10.10.10.1", "1.1.1.1"] },
              optional: false,
              fake3: 3,
            },
          },
        },
      };

      await exec();

      let expectedPayload = {
        dirPath: netplanDirPathFromConfig,
        fileName: netplanFileNameFromConfig,
        interfaces: [
          {
            name: "eth1",
            dhcp: true,
            optional: true,
          },
          {
            name: "eth2",
            dhcp: false,
            optional: false,
            ipAddress: "10.10.10.2",
            subnetMask: "255.255.255.0",
            gateway: "10.10.10.1",
            dns: ["10.10.10.1", "1.1.1.1"],
          },
        ],
      };

      expect(neplanConfigurator.Payload).toEqual(expectedPayload);
    });
  });

  describe("update", () => {
    let jsonFileContent;
    let fileContent;
    let netplanConfigurator;
    let createFile;
    let updatePayload;
    let initialPayload;

    beforeEach(() => {
      jsonFileContent = {
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

      fileContent = null;
      createFile = true;

      netplanConfigurator = new NetplanConfigurator(
        netplanDirPathFromConfig,
        netplanFileNameFromConfig
      );

      updatePayload = {
        dirPath: "updatedTestDirPath",
        fileName: "updatedTestFileName",
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
    });

    let exec = async () => {
      if (!fileContent) {
        fileContent = convertJSONToYaml(jsonFileContent);
      }

      if (createFile)
        await writeFileAsync(netplanFilePath, fileContent, "utf8");

      await netplanConfigurator.Load();

      initialPayload = netplanConfigurator.Payload;

      return netplanConfigurator.Update(updatePayload);
    };

    it("should update netplan configurator based on its payload", async () => {
      await exec();

      expect(netplanConfigurator.Payload).toEqual(updatePayload);
    });

    it("should update netplan configurator based on its payload - if gateway is 0.0.0.0", async () => {
      jsonFileContent = {
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

      await exec();

      expect(netplanConfigurator.Payload).toEqual(updatePayload);
    });

    it("should update netplan configurator based on its payload - even if netplanConfigurator was not initialized based on file", async () => {
      createFile = false;

      await exec();

      expect(netplanConfigurator.Payload).toEqual(updatePayload);
    });

    it("should update netplan configurator based on its payload - if interfaces are the same", async () => {
      updatePayload = {
        dirPath: "updatedTestDirPath",
        fileName: "updatedTestFileName",
        interfaces: [
          {
            name: "eth1",
            dhcp: true,
            optional: true,
          },
          {
            name: "eth2",
            dhcp: false,
            optional: false,
            ipAddress: "10.10.10.2",
            subnetMask: "255.255.255.0",
            gateway: "10.10.10.1",
            dns: ["10.10.10.1", "1.1.1.1"],
          },
        ],
      };

      await exec();

      expect(netplanConfigurator.Payload).toEqual(updatePayload);
    });

    it("should update netplan configurator based on its payload - if interfaces are the same and only updated", async () => {
      updatePayload = {
        dirPath: "updatedTestDirPath",
        fileName: "updatedTestFileName",
        interfaces: [
          {
            name: "eth1",
            dhcp: false,
            optional: false,
            ipAddress: "10.10.10.2",
            subnetMask: "255.255.255.0",
            gateway: "10.10.10.1",
            dns: ["10.10.10.1", "1.1.1.1"],
          },
          {
            name: "eth2",
            dhcp: true,
            optional: true,
          },
        ],
      };

      await exec();

      expect(netplanConfigurator.Payload).toEqual(updatePayload);
    });

    it("should update netplan configurator based on its payload - if there are no interfaces", async () => {
      updatePayload = {
        dirPath: "updatedTestDirPath",
        fileName: "updatedTestFileName",
        interfaces: [],
      };

      await exec();

      expect(netplanConfigurator.Payload).toEqual(updatePayload);
    });

    it("should update netplan configurator based on its payload - if new interface has dhcp: true and static paramters", async () => {
      updatePayload = {
        dirPath: "updatedTestDirPath",
        fileName: "updatedTestFileName",
        interfaces: [
          {
            name: "eth1",
            dhcp: true,
            optional: true,
          },
          {
            name: "eth2",
            dhcp: true,
            optional: false,
            ipAddress: "10.10.10.2",
            subnetMask: "255.255.255.0",
            gateway: "10.10.10.1",
            dns: ["10.10.10.1", "1.1.1.1"],
          },
        ],
      };

      await exec();

      let expectedPayload = {
        dirPath: "updatedTestDirPath",
        fileName: "updatedTestFileName",
        interfaces: [
          {
            name: "eth1",
            dhcp: true,
            optional: true,
          },
          {
            name: "eth2",
            dhcp: true,
            optional: false,
          },
        ],
      };

      expect(netplanConfigurator.Payload).toEqual(expectedPayload);
    });

    it("should update netplan configurator based on its payload - if new interface has dhcp: false and static paramters", async () => {
      updatePayload = {
        dirPath: "updatedTestDirPath",
        fileName: "updatedTestFileName",
        interfaces: [
          {
            name: "eth1",
            dhcp: true,
            optional: true,
          },
          {
            name: "eth2",
            dhcp: false,
            optional: false,
            ipAddress: "10.10.10.2",
            subnetMask: "255.255.255.0",
            gateway: "10.10.10.1",
            dns: ["10.10.10.1", "1.1.1.1"],
          },
        ],
      };

      await exec();

      let expectedPayload = {
        dirPath: "updatedTestDirPath",
        fileName: "updatedTestFileName",
        interfaces: [
          {
            name: "eth1",
            dhcp: true,
            optional: true,
          },
          {
            name: "eth2",
            dhcp: false,
            optional: false,
            ipAddress: "10.10.10.2",
            subnetMask: "255.255.255.0",
            gateway: "10.10.10.1",
            dns: ["10.10.10.1", "1.1.1.1"],
          },
        ],
      };

      expect(netplanConfigurator.Payload).toEqual(expectedPayload);
    });

    it("should not update netplan configurator if dirPath is not specified", async () => {
      delete updatePayload.dirPath;

      let error = null;

      await expect(
        new Promise(async (resolve, reject) => {
          try {
            await exec();
            return resolve(true);
          } catch (err) {
            error = err;
            return reject(err);
          }
        })
      ).rejects.toBeDefined();

      expect(error.message).toEqual(`"dirPath" is required`);

      expect(netplanConfigurator.Payload).toEqual(initialPayload);
    });

    it("should not update netplan configurator if dirPath is empty", async () => {
      updatePayload.dirPath = "";

      let error = null;

      await expect(
        new Promise(async (resolve, reject) => {
          try {
            await exec();
            return resolve(true);
          } catch (err) {
            error = err;
            return reject(err);
          }
        })
      ).rejects.toBeDefined();

      expect(error.message).toEqual(`"dirPath" is not allowed to be empty`);

      expect(netplanConfigurator.Payload).toEqual(initialPayload);
    });

    it("should not update netplan configurator if dirPath is not a string", async () => {
      updatePayload.dirPath = 2134;

      let error = null;

      await expect(
        new Promise(async (resolve, reject) => {
          try {
            await exec();
            return resolve(true);
          } catch (err) {
            error = err;
            return reject(err);
          }
        })
      ).rejects.toBeDefined();

      expect(error.message).toEqual(`"dirPath" must be a string`);

      expect(netplanConfigurator.Payload).toEqual(initialPayload);
    });

    it("should not update netplan configurator if fileName is not specified", async () => {
      delete updatePayload.fileName;

      let error = null;

      await expect(
        new Promise(async (resolve, reject) => {
          try {
            await exec();
            return resolve(true);
          } catch (err) {
            error = err;
            return reject(err);
          }
        })
      ).rejects.toBeDefined();

      expect(error.message).toEqual(`"fileName" is required`);

      expect(netplanConfigurator.Payload).toEqual(initialPayload);
    });

    it("should not update netplan configurator if fileName is empty", async () => {
      updatePayload.fileName = "";

      let error = null;

      await expect(
        new Promise(async (resolve, reject) => {
          try {
            await exec();
            return resolve(true);
          } catch (err) {
            error = err;
            return reject(err);
          }
        })
      ).rejects.toBeDefined();

      expect(error.message).toEqual(`"fileName" is not allowed to be empty`);

      expect(netplanConfigurator.Payload).toEqual(initialPayload);
    });

    it("should not update netplan configurator if fileName is not a string", async () => {
      updatePayload.fileName = 1234;

      let error = null;

      await expect(
        new Promise(async (resolve, reject) => {
          try {
            await exec();
            return resolve(true);
          } catch (err) {
            error = err;
            return reject(err);
          }
        })
      ).rejects.toBeDefined();

      expect(error.message).toEqual(`"fileName" must be a string`);

      expect(netplanConfigurator.Payload).toEqual(initialPayload);
    });

    it("should not update netplan configurator if interfaces is not specified", async () => {
      delete updatePayload.interfaces;

      let error = null;

      await expect(
        new Promise(async (resolve, reject) => {
          try {
            await exec();
            return resolve(true);
          } catch (err) {
            error = err;
            return reject(err);
          }
        })
      ).rejects.toBeDefined();

      expect(error.message).toEqual(`"interfaces" is required`);

      expect(netplanConfigurator.Payload).toEqual(initialPayload);
    });

    it("should not update netplan configurator if interfaces is not an array", async () => {
      updatePayload.interfaces = "avcd";

      let error = null;

      await expect(
        new Promise(async (resolve, reject) => {
          try {
            await exec();
            return resolve(true);
          } catch (err) {
            error = err;
            return reject(err);
          }
        })
      ).rejects.toBeDefined();

      expect(error.message).toEqual(`"interfaces" must be an array`);

      expect(netplanConfigurator.Payload).toEqual(initialPayload);
    });

    it("should not update netplan configurator if one of interface is invalid - name is not defined", async () => {
      delete updatePayload.interfaces[2].name;

      let error = null;

      await expect(
        new Promise(async (resolve, reject) => {
          try {
            await exec();
            return resolve(true);
          } catch (err) {
            error = err;
            return reject(err);
          }
        })
      ).rejects.toBeDefined();

      expect(error.message).toEqual(`"interfaces[2].name" is required`);

      expect(netplanConfigurator.Payload).toEqual(initialPayload);
    });

    it("should not update netplan configurator if one of interface is invalid - name is null", async () => {
      updatePayload.interfaces[2].name = null;

      let error = null;

      await expect(
        new Promise(async (resolve, reject) => {
          try {
            await exec();
            return resolve(true);
          } catch (err) {
            error = err;
            return reject(err);
          }
        })
      ).rejects.toBeDefined();

      expect(error.message).toEqual(`"interfaces[2].name" must be a string`);

      expect(netplanConfigurator.Payload).toEqual(initialPayload);
    });

    it("should not update netplan configurator if one of interface is invalid - name is empty string", async () => {
      updatePayload.interfaces[2].name = "";

      let error = null;

      await expect(
        new Promise(async (resolve, reject) => {
          try {
            await exec();
            return resolve(true);
          } catch (err) {
            error = err;
            return reject(err);
          }
        })
      ).rejects.toBeDefined();

      expect(error.message).toEqual(
        `"interfaces[2].name" is not allowed to be empty`
      );

      expect(netplanConfigurator.Payload).toEqual(initialPayload);
    });

    it("should not update netplan configurator if one of interface is invalid - name is not a string", async () => {
      updatePayload.interfaces[2].name = 1234;

      let error = null;

      await expect(
        new Promise(async (resolve, reject) => {
          try {
            await exec();
            return resolve(true);
          } catch (err) {
            error = err;
            return reject(err);
          }
        })
      ).rejects.toBeDefined();

      expect(error.message).toEqual(`"interfaces[2].name" must be a string`);

      expect(netplanConfigurator.Payload).toEqual(initialPayload);
    });

    it("should not update netplan configurator if one of interface is invalid - optional is not defined", async () => {
      delete updatePayload.interfaces[2].optional;

      let error = null;

      await expect(
        new Promise(async (resolve, reject) => {
          try {
            await exec();
            return resolve(true);
          } catch (err) {
            error = err;
            return reject(err);
          }
        })
      ).rejects.toBeDefined();

      expect(error.message).toEqual(`"interfaces[2].optional" is required`);

      expect(netplanConfigurator.Payload).toEqual(initialPayload);
    });

    it("should not update netplan configurator if one of interface is invalid - optional is null", async () => {
      updatePayload.interfaces[2].optional = null;

      let error = null;

      await expect(
        new Promise(async (resolve, reject) => {
          try {
            await exec();
            return resolve(true);
          } catch (err) {
            error = err;
            return reject(err);
          }
        })
      ).rejects.toBeDefined();

      expect(error.message).toEqual(
        `"interfaces[2].optional" must be a boolean`
      );

      expect(netplanConfigurator.Payload).toEqual(initialPayload);
    });

    it("should not update netplan configurator if one of interface is invalid - optional is not a boolean", async () => {
      updatePayload.interfaces[2].optional = "fake";

      let error = null;

      await expect(
        new Promise(async (resolve, reject) => {
          try {
            await exec();
            return resolve(true);
          } catch (err) {
            error = err;
            return reject(err);
          }
        })
      ).rejects.toBeDefined();

      expect(error.message).toEqual(
        `"interfaces[2].optional" must be a boolean`
      );

      expect(netplanConfigurator.Payload).toEqual(initialPayload);
    });

    it("should not update netplan configurator if one of interface is invalid - dhcp is not defined", async () => {
      delete updatePayload.interfaces[2].dhcp;

      let error = null;

      await expect(
        new Promise(async (resolve, reject) => {
          try {
            await exec();
            return resolve(true);
          } catch (err) {
            error = err;
            return reject(err);
          }
        })
      ).rejects.toBeDefined();

      expect(error.message).toEqual(`"interfaces[2].dhcp" is required`);

      expect(netplanConfigurator.Payload).toEqual(initialPayload);
    });

    it("should not update netplan configurator if one of interface is invalid - dhcp is null", async () => {
      updatePayload.interfaces[2].dhcp = null;

      let error = null;

      await expect(
        new Promise(async (resolve, reject) => {
          try {
            await exec();
            return resolve(true);
          } catch (err) {
            error = err;
            return reject(err);
          }
        })
      ).rejects.toBeDefined();

      expect(error.message).toEqual(`"interfaces[2].dhcp" must be a boolean`);

      expect(netplanConfigurator.Payload).toEqual(initialPayload);
    });

    it("should not update netplan configurator if one of interface is invalid - dhcp is not a boolean", async () => {
      updatePayload.interfaces[2].dhcp = "fake";

      let error = null;

      await expect(
        new Promise(async (resolve, reject) => {
          try {
            await exec();
            return resolve(true);
          } catch (err) {
            error = err;
            return reject(err);
          }
        })
      ).rejects.toBeDefined();

      expect(error.message).toEqual(`"interfaces[2].dhcp" must be a boolean`);

      expect(netplanConfigurator.Payload).toEqual(initialPayload);
    });

    it("should not update netplan configurator if one of interface is invalid - ipAddress is not defined but dhcp is false", async () => {
      updatePayload.interfaces[2].dhcp = false;
      delete updatePayload.interfaces[2].ipAddress;

      let error = null;

      await expect(
        new Promise(async (resolve, reject) => {
          try {
            await exec();
            return resolve(true);
          } catch (err) {
            error = err;
            return reject(err);
          }
        })
      ).rejects.toBeDefined();

      expect(error.message).toEqual(`"interfaces[2].ipAddress" is required`);

      expect(netplanConfigurator.Payload).toEqual(initialPayload);
    });

    it("should update netplan configurator if ipAddress is not defined but dhcp is true", async () => {
      updatePayload.interfaces[2].dhcp = true;
      delete updatePayload.interfaces[2].ipAddress;

      await exec();

      //After setting dhcp to true other static parameters should be not visible
      delete updatePayload.interfaces[2].ipAddress;
      delete updatePayload.interfaces[2].subnetMask;
      delete updatePayload.interfaces[2].dns;
      delete updatePayload.interfaces[2].gateway;

      expect(netplanConfigurator.Payload).toEqual(updatePayload);
    });

    it("should not update netplan configurator if one of interface is invalid - ipAddress is null but dhcp is false", async () => {
      updatePayload.interfaces[2].dhcp = false;
      updatePayload.interfaces[2].ipAddress = null;

      let error = null;

      await expect(
        new Promise(async (resolve, reject) => {
          try {
            await exec();
            return resolve(true);
          } catch (err) {
            error = err;
            return reject(err);
          }
        })
      ).rejects.toBeDefined();

      expect(error.message).toEqual(
        `"interfaces[2].ipAddress" must be a string`
      );

      expect(netplanConfigurator.Payload).toEqual(initialPayload);
    });

    it("should not update netplan configurator if one of interface is invalid - ipAddress is null but dhcp is true", async () => {
      updatePayload.interfaces[2].dhcp = true;
      updatePayload.interfaces[2].ipAddress = null;

      let error = null;

      await expect(
        new Promise(async (resolve, reject) => {
          try {
            await exec();
            return resolve(true);
          } catch (err) {
            error = err;
            return reject(err);
          }
        })
      ).rejects.toBeDefined();

      expect(error.message).toEqual(
        `"interfaces[2].ipAddress" must be a string`
      );

      expect(netplanConfigurator.Payload).toEqual(initialPayload);
    });

    it("should not update netplan configurator if one of interface is invalid - ipAddress is not a string but dhcp is false", async () => {
      updatePayload.interfaces[2].dhcp = false;
      updatePayload.interfaces[2].ipAddress = 1234;

      let error = null;

      await expect(
        new Promise(async (resolve, reject) => {
          try {
            await exec();
            return resolve(true);
          } catch (err) {
            error = err;
            return reject(err);
          }
        })
      ).rejects.toBeDefined();

      expect(error.message).toEqual(
        `"interfaces[2].ipAddress" must be a string`
      );

      expect(netplanConfigurator.Payload).toEqual(initialPayload);
    });

    it("should not update netplan configurator if one of interface is invalid - ipAddress is not a string but dhcp is true", async () => {
      updatePayload.interfaces[2].dhcp = true;
      updatePayload.interfaces[2].ipAddress = 1234;

      let error = null;

      await expect(
        new Promise(async (resolve, reject) => {
          try {
            await exec();
            return resolve(true);
          } catch (err) {
            error = err;
            return reject(err);
          }
        })
      ).rejects.toBeDefined();

      expect(error.message).toEqual(
        `"interfaces[2].ipAddress" must be a string`
      );

      expect(netplanConfigurator.Payload).toEqual(initialPayload);
    });

    it("should not update netplan configurator if one of interface is invalid - ipAddress is not a valid ip but dhcp is false", async () => {
      updatePayload.interfaces[2].dhcp = false;
      updatePayload.interfaces[2].ipAddress = "1234";

      let error = null;

      await expect(
        new Promise(async (resolve, reject) => {
          try {
            await exec();
            return resolve(true);
          } catch (err) {
            error = err;
            return reject(err);
          }
        })
      ).rejects.toBeDefined();

      expect(error.message).toEqual(
        `"interfaces[2].ipAddress" must be a valid ip address of one of the following versions [ipv4] with a forbidden CIDR`
      );

      expect(netplanConfigurator.Payload).toEqual(initialPayload);
    });

    it("should not update netplan configurator if one of interface is invalid - ipAddress is not a valid ip but dhcp is true", async () => {
      updatePayload.interfaces[2].dhcp = true;
      updatePayload.interfaces[2].ipAddress = "1234";

      let error = null;

      await expect(
        new Promise(async (resolve, reject) => {
          try {
            await exec();
            return resolve(true);
          } catch (err) {
            error = err;
            return reject(err);
          }
        })
      ).rejects.toBeDefined();

      expect(error.message).toEqual(
        `"interfaces[2].ipAddress" must be a valid ip address of one of the following versions [ipv4] with a forbidden CIDR`
      );

      expect(netplanConfigurator.Payload).toEqual(initialPayload);
    });

    it("should not update netplan configurator if one of interface is invalid - ipAddress is ip with CIDR but dhcp is false", async () => {
      updatePayload.interfaces[2].dhcp = false;
      updatePayload.interfaces[2].ipAddress = "192.168.0.10/24";

      let error = null;

      await expect(
        new Promise(async (resolve, reject) => {
          try {
            await exec();
            return resolve(true);
          } catch (err) {
            error = err;
            return reject(err);
          }
        })
      ).rejects.toBeDefined();

      expect(error.message).toEqual(
        `"interfaces[2].ipAddress" must be a valid ip address of one of the following versions [ipv4] with a forbidden CIDR`
      );

      expect(netplanConfigurator.Payload).toEqual(initialPayload);
    });

    it("should not update netplan configurator if one of interface is invalid - ipAddress is ip with CIDR ip but dhcp is true", async () => {
      updatePayload.interfaces[2].dhcp = true;
      updatePayload.interfaces[2].ipAddress = "192.168.0.10/24";

      let error = null;

      await expect(
        new Promise(async (resolve, reject) => {
          try {
            await exec();
            return resolve(true);
          } catch (err) {
            error = err;
            return reject(err);
          }
        })
      ).rejects.toBeDefined();

      expect(error.message).toEqual(
        `"interfaces[2].ipAddress" must be a valid ip address of one of the following versions [ipv4] with a forbidden CIDR`
      );

      expect(netplanConfigurator.Payload).toEqual(initialPayload);
    });

    it("should not update netplan configurator if one of interface is invalid - subnetMask is not defined but dhcp is false", async () => {
      updatePayload.interfaces[2].dhcp = false;
      delete updatePayload.interfaces[2].subnetMask;

      let error = null;

      await expect(
        new Promise(async (resolve, reject) => {
          try {
            await exec();
            return resolve(true);
          } catch (err) {
            error = err;
            return reject(err);
          }
        })
      ).rejects.toBeDefined();

      expect(error.message).toEqual(`"interfaces[2].subnetMask" is required`);

      expect(netplanConfigurator.Payload).toEqual(initialPayload);
    });

    it("should update netplan configurator if subnetMask is not defined but dhcp is true", async () => {
      updatePayload.interfaces[2].dhcp = true;
      delete updatePayload.interfaces[2].subnetMask;
      await exec();

      delete updatePayload.interfaces[2].ipAddress;
      delete updatePayload.interfaces[2].subnetMask;
      delete updatePayload.interfaces[2].gateway;
      delete updatePayload.interfaces[2].dns;

      expect(netplanConfigurator.Payload).toEqual(updatePayload);
    });

    it("should not update netplan configurator if one of interface is invalid - subnetMask is null but dhcp is false", async () => {
      updatePayload.interfaces[2].dhcp = false;
      updatePayload.interfaces[2].subnetMask = null;

      let error = null;

      await expect(
        new Promise(async (resolve, reject) => {
          try {
            await exec();
            return resolve(true);
          } catch (err) {
            error = err;
            return reject(err);
          }
        })
      ).rejects.toBeDefined();

      expect(error.message).toEqual(
        `"interfaces[2].subnetMask" must be a string`
      );

      expect(netplanConfigurator.Payload).toEqual(initialPayload);
    });

    it("should not update netplan configurator if one of interface is invalid - subnetMask is null but dhcp is true", async () => {
      updatePayload.interfaces[2].dhcp = true;
      updatePayload.interfaces[2].subnetMask = null;

      let error = null;

      await expect(
        new Promise(async (resolve, reject) => {
          try {
            await exec();
            return resolve(true);
          } catch (err) {
            error = err;
            return reject(err);
          }
        })
      ).rejects.toBeDefined();

      expect(error.message).toEqual(
        `"interfaces[2].subnetMask" must be a string`
      );

      expect(netplanConfigurator.Payload).toEqual(initialPayload);
    });

    it("should not update netplan configurator if one of interface is invalid - subnetMask is not a string but dhcp is false", async () => {
      updatePayload.interfaces[2].dhcp = false;
      updatePayload.interfaces[2].subnetMask = 1234;

      let error = null;

      await expect(
        new Promise(async (resolve, reject) => {
          try {
            await exec();
            return resolve(true);
          } catch (err) {
            error = err;
            return reject(err);
          }
        })
      ).rejects.toBeDefined();

      expect(error.message).toEqual(
        `"interfaces[2].subnetMask" must be a string`
      );

      expect(netplanConfigurator.Payload).toEqual(initialPayload);
    });

    it("should not update netplan configurator if one of interface is invalid - subnetMask is not a string but dhcp is true", async () => {
      updatePayload.interfaces[2].dhcp = true;
      updatePayload.interfaces[2].subnetMask = 1234;

      let error = null;

      await expect(
        new Promise(async (resolve, reject) => {
          try {
            await exec();
            return resolve(true);
          } catch (err) {
            error = err;
            return reject(err);
          }
        })
      ).rejects.toBeDefined();

      expect(error.message).toEqual(
        `"interfaces[2].subnetMask" must be a string`
      );

      expect(netplanConfigurator.Payload).toEqual(initialPayload);
    });

    it("should not update netplan configurator if one of interface is invalid - subnetMask is not a valid ip but dhcp is false", async () => {
      updatePayload.interfaces[2].dhcp = false;
      updatePayload.interfaces[2].subnetMask = "1234";

      let error = null;

      await expect(
        new Promise(async (resolve, reject) => {
          try {
            await exec();
            return resolve(true);
          } catch (err) {
            error = err;
            return reject(err);
          }
        })
      ).rejects.toBeDefined();

      expect(error.message).toEqual(
        `"interfaces[2].subnetMask" must be a valid ip address of one of the following versions [ipv4] with a forbidden CIDR`
      );

      expect(netplanConfigurator.Payload).toEqual(initialPayload);
    });

    it("should not update netplan configurator if one of interface is invalid - subnetMask is not a valid ip but dhcp is true", async () => {
      updatePayload.interfaces[2].dhcp = true;
      updatePayload.interfaces[2].subnetMask = "1234";

      let error = null;

      await expect(
        new Promise(async (resolve, reject) => {
          try {
            await exec();
            return resolve(true);
          } catch (err) {
            error = err;
            return reject(err);
          }
        })
      ).rejects.toBeDefined();

      expect(error.message).toEqual(
        `"interfaces[2].subnetMask" must be a valid ip address of one of the following versions [ipv4] with a forbidden CIDR`
      );

      expect(netplanConfigurator.Payload).toEqual(initialPayload);
    });

    it("should not update netplan configurator if one of interface is invalid - subnetMask is ip with CIDR but dhcp is false", async () => {
      updatePayload.interfaces[2].dhcp = false;
      updatePayload.interfaces[2].subnetMask = "192.168.0.10/24";

      let error = null;

      await expect(
        new Promise(async (resolve, reject) => {
          try {
            await exec();
            return resolve(true);
          } catch (err) {
            error = err;
            return reject(err);
          }
        })
      ).rejects.toBeDefined();

      expect(error.message).toEqual(
        `"interfaces[2].subnetMask" must be a valid ip address of one of the following versions [ipv4] with a forbidden CIDR`
      );

      expect(netplanConfigurator.Payload).toEqual(initialPayload);
    });

    it("should not update netplan configurator if one of interface is invalid - subnetMask is ip with CIDR ip but dhcp is true", async () => {
      updatePayload.interfaces[2].dhcp = true;
      updatePayload.interfaces[2].subnetMask = "192.168.0.10/24";

      let error = null;

      await expect(
        new Promise(async (resolve, reject) => {
          try {
            await exec();
            return resolve(true);
          } catch (err) {
            error = err;
            return reject(err);
          }
        })
      ).rejects.toBeDefined();

      expect(error.message).toEqual(
        `"interfaces[2].subnetMask" must be a valid ip address of one of the following versions [ipv4] with a forbidden CIDR`
      );

      expect(netplanConfigurator.Payload).toEqual(initialPayload);
    });

    it("should not update netplan configurator if one of interface is invalid - gateway is not defined but dhcp is false", async () => {
      updatePayload.interfaces[2].dhcp = false;
      delete updatePayload.interfaces[2].gateway;

      let error = null;

      await expect(
        new Promise(async (resolve, reject) => {
          try {
            await exec();
            return resolve(true);
          } catch (err) {
            error = err;
            return reject(err);
          }
        })
      ).rejects.toBeDefined();

      expect(error.message).toEqual(`"interfaces[2].gateway" is required`);

      expect(netplanConfigurator.Payload).toEqual(initialPayload);
    });

    it("should update netplan configurator if gateway is not defined but dhcp is true", async () => {
      updatePayload.interfaces[2].dhcp = true;
      delete updatePayload.interfaces[2].gateway;
      await exec();

      delete updatePayload.interfaces[2].ipAddress;
      delete updatePayload.interfaces[2].subnetMask;
      delete updatePayload.interfaces[2].gateway;
      delete updatePayload.interfaces[2].dns;

      expect(netplanConfigurator.Payload).toEqual(updatePayload);
    });

    it("should not update netplan configurator if one of interface is invalid - gateway is null but dhcp is false", async () => {
      updatePayload.interfaces[2].dhcp = false;
      updatePayload.interfaces[2].gateway = null;

      let error = null;

      await expect(
        new Promise(async (resolve, reject) => {
          try {
            await exec();
            return resolve(true);
          } catch (err) {
            error = err;
            return reject(err);
          }
        })
      ).rejects.toBeDefined();

      expect(error.message).toEqual(`"interfaces[2].gateway" must be a string`);

      expect(netplanConfigurator.Payload).toEqual(initialPayload);
    });

    it("should not update netplan configurator if one of interface is invalid - gateway is null but dhcp is true", async () => {
      updatePayload.interfaces[2].dhcp = true;
      updatePayload.interfaces[2].gateway = null;

      let error = null;

      await expect(
        new Promise(async (resolve, reject) => {
          try {
            await exec();
            return resolve(true);
          } catch (err) {
            error = err;
            return reject(err);
          }
        })
      ).rejects.toBeDefined();

      expect(error.message).toEqual(`"interfaces[2].gateway" must be a string`);

      expect(netplanConfigurator.Payload).toEqual(initialPayload);
    });

    it("should not update netplan configurator if one of interface is invalid - gateway is not a string but dhcp is false", async () => {
      updatePayload.interfaces[2].dhcp = false;
      updatePayload.interfaces[2].gateway = 1234;

      let error = null;

      await expect(
        new Promise(async (resolve, reject) => {
          try {
            await exec();
            return resolve(true);
          } catch (err) {
            error = err;
            return reject(err);
          }
        })
      ).rejects.toBeDefined();

      expect(error.message).toEqual(`"interfaces[2].gateway" must be a string`);

      expect(netplanConfigurator.Payload).toEqual(initialPayload);
    });

    it("should not update netplan configurator if one of interface is invalid - gateway is not a string but dhcp is true", async () => {
      updatePayload.interfaces[2].dhcp = true;
      updatePayload.interfaces[2].gateway = 1234;

      let error = null;

      await expect(
        new Promise(async (resolve, reject) => {
          try {
            await exec();
            return resolve(true);
          } catch (err) {
            error = err;
            return reject(err);
          }
        })
      ).rejects.toBeDefined();

      expect(error.message).toEqual(`"interfaces[2].gateway" must be a string`);

      expect(netplanConfigurator.Payload).toEqual(initialPayload);
    });

    it("should not update netplan configurator if one of interface is invalid - gateway is not a valid ip but dhcp is false", async () => {
      updatePayload.interfaces[2].dhcp = false;
      updatePayload.interfaces[2].gateway = "1234";

      let error = null;

      await expect(
        new Promise(async (resolve, reject) => {
          try {
            await exec();
            return resolve(true);
          } catch (err) {
            error = err;
            return reject(err);
          }
        })
      ).rejects.toBeDefined();

      expect(error.message).toEqual(
        `"interfaces[2].gateway" must be a valid ip address of one of the following versions [ipv4] with a forbidden CIDR`
      );

      expect(netplanConfigurator.Payload).toEqual(initialPayload);
    });

    it("should not update netplan configurator if one of interface is invalid - gateway is not a valid ip but dhcp is true", async () => {
      updatePayload.interfaces[2].dhcp = true;
      updatePayload.interfaces[2].gateway = "1234";

      let error = null;

      await expect(
        new Promise(async (resolve, reject) => {
          try {
            await exec();
            return resolve(true);
          } catch (err) {
            error = err;
            return reject(err);
          }
        })
      ).rejects.toBeDefined();

      expect(error.message).toEqual(
        `"interfaces[2].gateway" must be a valid ip address of one of the following versions [ipv4] with a forbidden CIDR`
      );

      expect(netplanConfigurator.Payload).toEqual(initialPayload);
    });

    it("should not update netplan configurator if one of interface is invalid - gateway is ip with CIDR but dhcp is false", async () => {
      updatePayload.interfaces[2].dhcp = false;
      updatePayload.interfaces[2].gateway = "192.168.0.10/24";

      let error = null;

      await expect(
        new Promise(async (resolve, reject) => {
          try {
            await exec();
            return resolve(true);
          } catch (err) {
            error = err;
            return reject(err);
          }
        })
      ).rejects.toBeDefined();

      expect(error.message).toEqual(
        `"interfaces[2].gateway" must be a valid ip address of one of the following versions [ipv4] with a forbidden CIDR`
      );

      expect(netplanConfigurator.Payload).toEqual(initialPayload);
    });

    it("should not update netplan configurator if one of interface is invalid - gateway is ip with CIDR ip but dhcp is true", async () => {
      updatePayload.interfaces[2].dhcp = true;
      updatePayload.interfaces[2].gateway = "192.168.0.10/24";

      let error = null;

      await expect(
        new Promise(async (resolve, reject) => {
          try {
            await exec();
            return resolve(true);
          } catch (err) {
            error = err;
            return reject(err);
          }
        })
      ).rejects.toBeDefined();

      expect(error.message).toEqual(
        `"interfaces[2].gateway" must be a valid ip address of one of the following versions [ipv4] with a forbidden CIDR`
      );

      expect(netplanConfigurator.Payload).toEqual(initialPayload);
    });

    it("should not update netplan configurator if one of interface is invalid - dns is not defined but dhcp is false", async () => {
      updatePayload.interfaces[2].dhcp = false;
      delete updatePayload.interfaces[2].dns;

      let error = null;

      await expect(
        new Promise(async (resolve, reject) => {
          try {
            await exec();
            return resolve(true);
          } catch (err) {
            error = err;
            return reject(err);
          }
        })
      ).rejects.toBeDefined();

      expect(error.message).toEqual(`"interfaces[2].dns" is required`);

      expect(netplanConfigurator.Payload).toEqual(initialPayload);
    });

    it("should update netplan configurator if dns is not defined but dhcp is true", async () => {
      updatePayload.interfaces[2].dhcp = true;
      delete updatePayload.interfaces[2].dns;
      await exec();

      delete updatePayload.interfaces[2].ipAddress;
      delete updatePayload.interfaces[2].subnetMask;
      delete updatePayload.interfaces[2].gateway;
      delete updatePayload.interfaces[2].dns;

      expect(netplanConfigurator.Payload).toEqual(updatePayload);
    });

    it("should update netplan configurator if dns is an empty array but dhcp is false", async () => {
      updatePayload.interfaces[2].dhcp = false;
      updatePayload.interfaces[2].dns = [];
      await exec();

      expect(netplanConfigurator.Payload).toEqual(updatePayload);
    });

    it("should update netplan configurator if dns is an empty array but dhcp is true", async () => {
      updatePayload.interfaces[2].dhcp = true;
      updatePayload.interfaces[2].dns = [];
      await exec();

      delete updatePayload.interfaces[2].ipAddress;
      delete updatePayload.interfaces[2].subnetMask;
      delete updatePayload.interfaces[2].gateway;
      delete updatePayload.interfaces[2].dns;

      expect(netplanConfigurator.Payload).toEqual(updatePayload);
    });

    it("should not update netplan configurator if one of interface is invalid - dns is null but dhcp is false", async () => {
      updatePayload.interfaces[2].dhcp = false;
      updatePayload.interfaces[2].dns = null;

      let error = null;

      await expect(
        new Promise(async (resolve, reject) => {
          try {
            await exec();
            return resolve(true);
          } catch (err) {
            error = err;
            return reject(err);
          }
        })
      ).rejects.toBeDefined();

      expect(error.message).toEqual(`"interfaces[2].dns" must be an array`);

      expect(netplanConfigurator.Payload).toEqual(initialPayload);
    });

    it("should not update netplan configurator if one of interface is invalid - dns is null but dhcp is true", async () => {
      updatePayload.interfaces[2].dhcp = true;
      updatePayload.interfaces[2].dns = null;

      let error = null;

      await expect(
        new Promise(async (resolve, reject) => {
          try {
            await exec();
            return resolve(true);
          } catch (err) {
            error = err;
            return reject(err);
          }
        })
      ).rejects.toBeDefined();

      expect(error.message).toEqual(`"interfaces[2].dns" must be an array`);

      expect(netplanConfigurator.Payload).toEqual(initialPayload);
    });

    it("should not update netplan configurator if one of interface is invalid - dns is not a string but dhcp is false", async () => {
      updatePayload.interfaces[2].dhcp = false;
      updatePayload.interfaces[2].dns = 1234;

      let error = null;

      await expect(
        new Promise(async (resolve, reject) => {
          try {
            await exec();
            return resolve(true);
          } catch (err) {
            error = err;
            return reject(err);
          }
        })
      ).rejects.toBeDefined();

      expect(error.message).toEqual(`"interfaces[2].dns" must be an array`);

      expect(netplanConfigurator.Payload).toEqual(initialPayload);
    });

    it("should not update netplan configurator if one of interface is invalid - dns is not a string but dhcp is true", async () => {
      updatePayload.interfaces[2].dhcp = true;
      updatePayload.interfaces[2].dns = 1234;

      let error = null;

      await expect(
        new Promise(async (resolve, reject) => {
          try {
            await exec();
            return resolve(true);
          } catch (err) {
            error = err;
            return reject(err);
          }
        })
      ).rejects.toBeDefined();

      expect(error.message).toEqual(`"interfaces[2].dns" must be an array`);

      expect(netplanConfigurator.Payload).toEqual(initialPayload);
    });

    it("should not update netplan configurator if one of interface is invalid - dns is not a valid ip but dhcp is false", async () => {
      updatePayload.interfaces[2].dhcp = false;
      updatePayload.interfaces[2].dns = ["1234"];

      let error = null;

      await expect(
        new Promise(async (resolve, reject) => {
          try {
            await exec();
            return resolve(true);
          } catch (err) {
            error = err;
            return reject(err);
          }
        })
      ).rejects.toBeDefined();

      expect(error.message).toEqual(
        `"interfaces[2].dns[0]" must be a valid ip address of one of the following versions [ipv4] with a forbidden CIDR`
      );

      expect(netplanConfigurator.Payload).toEqual(initialPayload);
    });

    it("should not update netplan configurator if one of interface is invalid - dns is not a valid ip but dhcp is true", async () => {
      updatePayload.interfaces[2].dhcp = true;
      updatePayload.interfaces[2].dns = ["1234"];

      let error = null;

      await expect(
        new Promise(async (resolve, reject) => {
          try {
            await exec();
            return resolve(true);
          } catch (err) {
            error = err;
            return reject(err);
          }
        })
      ).rejects.toBeDefined();

      expect(error.message).toEqual(
        `"interfaces[2].dns[0]" must be a valid ip address of one of the following versions [ipv4] with a forbidden CIDR`
      );

      expect(netplanConfigurator.Payload).toEqual(initialPayload);
    });

    it("should not update netplan configurator if one of interface is invalid - dns is ip with CIDR but dhcp is false", async () => {
      updatePayload.interfaces[2].dhcp = false;
      updatePayload.interfaces[2].dns = ["192.168.0.10/24"];

      let error = null;

      await expect(
        new Promise(async (resolve, reject) => {
          try {
            await exec();
            return resolve(true);
          } catch (err) {
            error = err;
            return reject(err);
          }
        })
      ).rejects.toBeDefined();

      expect(error.message).toEqual(
        `"interfaces[2].dns[0]" must be a valid ip address of one of the following versions [ipv4] with a forbidden CIDR`
      );

      expect(netplanConfigurator.Payload).toEqual(initialPayload);
    });

    it("should not update netplan configurator if one of interface is invalid - dns is ip with CIDR ip but dhcp is true", async () => {
      updatePayload.interfaces[2].dhcp = true;
      updatePayload.interfaces[2].dns = ["192.168.0.10/24"];

      let error = null;

      await expect(
        new Promise(async (resolve, reject) => {
          try {
            await exec();
            return resolve(true);
          } catch (err) {
            error = err;
            return reject(err);
          }
        })
      ).rejects.toBeDefined();

      expect(error.message).toEqual(
        `"interfaces[2].dns[0]" must be a valid ip address of one of the following versions [ipv4] with a forbidden CIDR`
      );

      expect(netplanConfigurator.Payload).toEqual(initialPayload);
    });
  });

  describe("Save", () => {
    let initialJsonFileContent;
    let fileContent;
    let netplanConfigurator;
    let createFile;
    let updateNetplanConfigurator;
    let updatePayload;
    let initialPayload;

    beforeEach(() => {
      initialJsonFileContent = {
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

      fileContent = null;
      createFile = true;

      netplanConfigurator = new NetplanConfigurator(
        netplanDirPathFromConfig,
        netplanFileNameFromConfig
      );

      updateNetplanConfigurator = true;
      updatePayload = {
        dirPath: netplanDirPathFromConfig,
        fileName: netplanFileNameFromConfig,
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
    });

    let exec = async () => {
      if (!fileContent) {
        fileContent = convertJSONToYaml(initialJsonFileContent);
      }

      if (createFile)
        await writeFileAsync(netplanFilePath, fileContent, "utf8");

      await netplanConfigurator.Load();

      initialPayload = netplanConfigurator.Payload;

      if (updateNetplanConfigurator) netplanConfigurator.Update(updatePayload);

      return netplanConfigurator.Save();
    };

    it("should save all new configuration to neplan file", async () => {
      await exec();

      let fileContent = await readFileAsync(netplanFilePath, "utf8");
      expect(fileContent).toBeDefined();

      let jsonFileContent = await convertYamlToJSON(fileContent);

      let expectedContent = {
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

      expect(jsonFileContent).toEqual(expectedContent);
    });

    it("should save all new configuration to neplan file - if gateway is not set and interface did not exist", async () => {
      initialJsonFileContent = {
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

      updatePayload = {
        dirPath: netplanDirPathFromConfig,
        fileName: netplanFileNameFromConfig,
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
            gateway: "0.0.0.0",
            dns: ["10.10.10.1", "1.1.1.1"],
          },
        ],
      };

      await exec();

      let fileContent = await readFileAsync(netplanFilePath, "utf8");
      expect(fileContent).toBeDefined();

      let jsonFileContent = await convertYamlToJSON(fileContent);

      //Gateway4 should not be present
      let expectedContent = {
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
              nameservers: { addresses: ["10.10.10.1", "1.1.1.1"] },
            },
          },
        },
      };

      expect(jsonFileContent).toEqual(expectedContent);
    });

    it("should save all new configuration to neplan file - if gateway is not set and interface did exist with non-empty gateway4", async () => {
      initialJsonFileContent = {
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

      updatePayload = {
        dirPath: netplanDirPathFromConfig,
        fileName: netplanFileNameFromConfig,
        interfaces: [
          {
            name: "eth2",
            dhcp: false,
            optional: true,
            ipAddress: "10.10.10.2",
            subnetMask: "255.255.255.0",
            gateway: "0.0.0.0",
            dns: ["10.10.10.1", "1.1.1.1"],
          },
          {
            name: "eth3",
            dhcp: true,
            optional: false,
          },
        ],
      };

      await exec();

      let fileContent = await readFileAsync(netplanFilePath, "utf8");
      expect(fileContent).toBeDefined();

      let newJsonFileContent = await convertYamlToJSON(fileContent);

      //Gateway4 should not be present
      let expectedContent = {
        network: {
          version: 2,
          ethernets: {
            eth2: {
              dhcp4: false,
              optional: true,
              addresses: ["10.10.10.2/24"],
              nameservers: { addresses: ["10.10.10.1", "1.1.1.1"] },
            },
            eth3: {
              dhcp4: true,
              optional: false,
            },
          },
        },
      };

      expect(newJsonFileContent).toEqual(expectedContent);
    });

    it("should save all new configuration to neplan file - if gateway is not set and interface did exist with an empty gateway4", async () => {
      initialJsonFileContent = {
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

      updatePayload = {
        dirPath: netplanDirPathFromConfig,
        fileName: netplanFileNameFromConfig,
        interfaces: [
          {
            name: "eth2",
            dhcp: false,
            optional: true,
            ipAddress: "10.10.10.2",
            subnetMask: "255.255.255.0",
            gateway: "0.0.0.0",
            dns: ["10.10.10.1", "1.1.1.1"],
          },
          {
            name: "eth3",
            dhcp: true,
            optional: false,
          },
        ],
      };

      await exec();

      let fileContent = await readFileAsync(netplanFilePath, "utf8");
      expect(fileContent).toBeDefined();

      let newJsonFileContent = await convertYamlToJSON(fileContent);

      //Gateway4 should not be present
      let expectedContent = {
        network: {
          version: 2,
          ethernets: {
            eth2: {
              dhcp4: false,
              optional: true,
              addresses: ["10.10.10.2/24"],
              nameservers: { addresses: ["10.10.10.1", "1.1.1.1"] },
            },
            eth3: {
              dhcp4: true,
              optional: false,
            },
          },
        },
      };

      expect(newJsonFileContent).toEqual(expectedContent);
    });

    it("should save all new configuration to neplan file - even if there is no initial file", async () => {
      createFile = false;

      await exec();

      let fileContent = await readFileAsync(netplanFilePath, "utf8");
      expect(fileContent).toBeDefined();

      let jsonFileContent = await convertYamlToJSON(fileContent);

      let expectedContent = {
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

      expect(jsonFileContent).toEqual(expectedContent);
    });

    it("should throw if there is no netplan dir", async () => {
      updatePayload.dirPath = "falseDir";

      let error = null;

      await expect(
        new Promise(async (resolve, reject) => {
          try {
            await exec();
            return resolve(true);
          } catch (err) {
            error = err;
            return reject(err);
          }
        })
      ).rejects.toBeDefined();

      expect(error.message).toEqual(
        "ENOENT: no such file or directory, open 'falseDir/testConfigYamlFile.yaml'"
      );
    });

    it("should save all new configuration to neplan file - if there are no interfaces", async () => {
      updatePayload.interfaces = [];

      await exec();

      let fileContent = await readFileAsync(netplanFilePath, "utf8");
      expect(fileContent).toBeDefined();

      let jsonFileContent = await convertYamlToJSON(fileContent);

      let expectedContent = {
        network: {
          version: 2,
          ethernets: {},
        },
      };

      expect(jsonFileContent).toEqual(expectedContent);
    });

    it("should save all new configuration to neplan file - if one of interfaces has dhcp = true but addresses set to static", async () => {
      updatePayload.interfaces[2].dhcp = true;

      await exec();

      let fileContent = await readFileAsync(netplanFilePath, "utf8");
      expect(fileContent).toBeDefined();

      let jsonFileContent = await convertYamlToJSON(fileContent);

      let expectedContent = {
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

      expect(jsonFileContent).toEqual(expectedContent);
    });

    it("should save all new configuration to neplan file - if netplan configurator was not initialized", async () => {
      createFile = false;
      updateNetplanConfigurator = false;

      await exec();

      let fileContent = await readFileAsync(netplanFilePath, "utf8");
      expect(fileContent).toBeDefined();

      let jsonContent = await convertYamlToJSON(fileContent);

      let expectedContent = {
        network: {
          version: 2,
          ethernets: {},
        },
      };

      expect(jsonContent).toEqual(expectedContent);
    });

    it("should save all new configuration to neplan file - if one of interfaces has dhcp = false but static addresses were not set", async () => {
      initialJsonFileContent = {
        network: {
          version: 2,
          ethernets: {
            eth1: {
              dhcp4: true,
              optional: true,
            },
            eth2: {
              dhcp4: false,
              optional: true,
            },
          },
        },
      };

      updateNetplanConfigurator = false;

      await exec();

      let fileContent = await readFileAsync(netplanFilePath, "utf8");
      expect(fileContent).toBeDefined();

      let jsonContent = await convertYamlToJSON(fileContent);

      let expectedContent = {
        network: {
          version: 2,
          ethernets: {
            eth1: {
              dhcp4: true,
              optional: true,
            },
            eth2: {
              dhcp4: false,
              optional: true,
            },
          },
        },
      };

      expect(jsonContent).toEqual(expectedContent);
    });

    it("should save all new configuration to neplan file - if one of interfaces has dhcp = false but static IPAddress was not set", async () => {
      initialJsonFileContent = {
        network: {
          version: 2,
          ethernets: {
            eth1: {
              dhcp4: true,
              optional: true,
            },
            eth2: {
              dhcp4: false,
              optional: true,
              gateway4: "10.10.10.1",
              nameservers: { addresses: ["10.10.10.1", "1.1.1.1"] },
              optional: false,
            },
          },
        },
      };

      updateNetplanConfigurator = false;

      await exec();

      let fileContent = await readFileAsync(netplanFilePath, "utf8");
      expect(fileContent).toBeDefined();

      let jsonContent = await convertYamlToJSON(fileContent);

      let expectedContent = {
        network: {
          version: 2,
          ethernets: {
            eth1: {
              dhcp4: true,
              optional: true,
            },
            eth2: {
              dhcp4: false,
              optional: true,
              gateway4: "10.10.10.1",
              nameservers: { addresses: ["10.10.10.1", "1.1.1.1"] },
              optional: false,
            },
          },
        },
      };

      expect(jsonContent).toEqual(expectedContent);
    });

    it("should save all new configuration to neplan file - if one of interfaces has dhcp = false but static gateway was not set", async () => {
      initialJsonFileContent = {
        network: {
          version: 2,
          ethernets: {
            eth1: {
              dhcp4: true,
              optional: true,
            },
            eth2: {
              dhcp4: false,
              optional: true,
              addresses: ["10.10.10.1/24"],
              nameservers: { addresses: ["10.10.10.1", "1.1.1.1"] },
              optional: false,
            },
          },
        },
      };

      updateNetplanConfigurator = false;

      await exec();

      let fileContent = await readFileAsync(netplanFilePath, "utf8");
      expect(fileContent).toBeDefined();

      let jsonContent = await convertYamlToJSON(fileContent);

      let expectedContent = {
        network: {
          version: 2,
          ethernets: {
            eth1: {
              dhcp4: true,
              optional: true,
            },
            eth2: {
              dhcp4: false,
              optional: true,
              addresses: ["10.10.10.1/24"],
              nameservers: { addresses: ["10.10.10.1", "1.1.1.1"] },
              optional: false,
            },
          },
        },
      };

      expect(jsonContent).toEqual(expectedContent);
    });

    it("should save all new configuration to neplan file - if one of interfaces has dhcp = false but static dns was not set", async () => {
      initialJsonFileContent = {
        network: {
          version: 2,
          ethernets: {
            eth1: {
              dhcp4: true,
              optional: true,
            },
            eth2: {
              dhcp4: false,
              optional: true,
              addresses: ["10.10.10.10/24"],
              gateway4: "10.10.10.1",
              optional: false,
            },
          },
        },
      };

      updateNetplanConfigurator = false;

      await exec();

      let fileContent = await readFileAsync(netplanFilePath, "utf8");
      expect(fileContent).toBeDefined();

      let jsonContent = await convertYamlToJSON(fileContent);

      let expectedContent = {
        network: {
          version: 2,
          ethernets: {
            eth1: {
              dhcp4: true,
              optional: true,
            },
            eth2: {
              dhcp4: false,
              optional: true,
              addresses: ["10.10.10.10/24"],
              gateway4: "10.10.10.1",
              optional: false,
            },
          },
        },
      };

      expect(jsonContent).toEqual(expectedContent);
    });

    it("should save all new configuration to neplan file - if one of interfaces has dhcp = false but dns are empty", async () => {
      initialJsonFileContent = {
        network: {
          version: 2,
          ethernets: {
            eth1: {
              dhcp4: true,
              optional: true,
            },
            eth2: {
              dhcp4: false,
              optional: true,
              addresses: ["10.10.10.10/24"],
              gateway4: "10.10.10.1",
              optional: false,
              nameservers: { addresses: [] },
            },
          },
        },
      };

      updateNetplanConfigurator = false;

      await exec();

      let fileContent = await readFileAsync(netplanFilePath, "utf8");
      expect(fileContent).toBeDefined();

      let jsonContent = await convertYamlToJSON(fileContent);

      let expectedContent = {
        network: {
          version: 2,
          ethernets: {
            eth1: {
              dhcp4: true,
              optional: true,
            },
            eth2: {
              dhcp4: false,
              optional: true,
              addresses: ["10.10.10.10/24"],
              gateway4: "10.10.10.1",
              optional: false,
            },
          },
        },
      };

      expect(jsonContent).toEqual(expectedContent);
    });
  });

  describe("ApplyChanges", () => {
    let netplanConfigurator;
    let applyCommand;

    beforeEach(() => {
      jest.clearAllMocks();
      applyCommand = "netplan apply";
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    let exec = async () => {
      netplanConfigurator = new NetplanConfigurator(
        netplanDirPathFromConfig,
        netplanFileNameFromConfig,
        applyCommand
      );
      return netplanConfigurator.ApplyChanges();
    };

    it("should invoke exec with 'netplan apply'", async () => {
      await exec();

      expect(mockExec).toHaveBeenCalledTimes(1);
      expect(mockExec.mock.calls[0][0]).toEqual("netplan apply");
    });

    it("should invoke exec with command given in argument of constructor", async () => {
      applyCommand = "testCommand";
      await exec();

      expect(mockExec).toHaveBeenCalledTimes(1);
      expect(mockExec.mock.calls[0][0]).toEqual("testCommand");
    });
  });
});
