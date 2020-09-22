const path = require("path");
const config = require("config");
const {
  clearDirectoryAsync,
  writeFileAsync,
  convertJSONToYaml,
  removeFileOrDirectoryAsync,
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
const { clear } = require("console");

describe("NetplanConfigurator", () => {
  let execMockFunc;

  beforeEach(async () => {
    //Clear fake netplan dir
    await clearDirectoryAsync(netplanDirPathFromConfig);

    //Creating mock exec func - to prevent calling netplan apply
    execMockFunc = jest.fn();
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

      neplanConfigurator = new NetplanConfigurator(
        netplanDirPathFromConfig,
        netplanFileNameFromConfig
      );
    });

    let exec = async () => {
      if (!fileContent) {
        fileContent = convertJSONToYaml(jsonFileContent);
      }

      if (createFile)
        await writeFileAsync(netplanFilePath, fileContent, "utf8");

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
            gateway: "",
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

      return netplanConfigurator.update(updatePayload);
    };

    it("should update netplan configurator based on its payload", async () => {
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
  });
});
