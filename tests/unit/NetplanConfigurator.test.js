const path = require("path");
const config = require("config");
const utilities = require("../../utilities/utilities");
const { clearDirectoryAsync } = require("../../utilities/utilities");
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
});
