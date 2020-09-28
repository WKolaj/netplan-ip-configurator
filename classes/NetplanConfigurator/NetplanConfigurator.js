const path = require("path");
const {
  NetplanInterfaceConfiguration,
  NetplanInterfaceConfigurationSchema,
} = require("./NetplanInterfaceConfiguration");
const {
  convertYamlToJSON,
  convertJSONToYaml,
  checkIfDirectoryExistsAsync,
  readDirAsync,
  readFileAsync,
  writeFileAsync,
  checkIfFileExistsAsync,
  execAsync,
} = require("../../utilities/utilities");
const Joi = require("joi");

/**
 * @description Schema for netplan configurator
 */
const NetplanConfiguratorSchema = Joi.object({
  dirPath: Joi.string().min(1).required(),
  fileName: Joi.string().min(1).required(),
  interfaces: Joi.array()
    .items(NetplanInterfaceConfigurationSchema)
    .unique("name")
    .required(),
});

/**
 * @description Netplan configurator object
 */
class NetplanConfigurator {
  /**
   * @description Netplan configurator object
   * @param {String} dirPath Path do netplan directory
   * @param {String} fileName File name with configuration
   */
  constructor(dirPath = "/etc/netplan", fileName = "00-installer-config.yaml") {
    this._dirPath = dirPath;
    this._fileName = fileName;
    this._interfaces = {};
  }

  /**
   * @description Path do netplan directory
   */
  get DirPath() {
    return this._dirPath;
  }

  /**
   * @description File name containing configuration
   */
  get FileName() {
    return this._fileName;
  }

  /**
   * @description Interfaces from content
   */
  get Interfaces() {
    return this._interfaces;
  }

  /**
   * @description Method for loading all data from netplan config file - if file does not exists, content will remaing empty
   */
  async Load() {
    await this._loadInterfaces();
  }

  /**
   * @description Method for loading whole content from file to configurator and set interfaces based on this content
   */
  async _loadInterfaces() {
    let content = await this._getContentFromFile();

    //Clear interfaces
    this._interfaces = {};

    //If content is proper - create,initialzie and add interface for every network ethernet
    if (content && content.network && content.network.ethernets) {
      let allNetworkEthernetNames = Object.keys(content.network.ethernets);

      for (let networkEthernetName of allNetworkEthernetNames) {
        let networkEthernetConfiguration =
          content.network.ethernets[networkEthernetName];
        let networkNetplanConfiguration = new NetplanInterfaceConfiguration(
          networkEthernetName
        );
        networkNetplanConfiguration.InitFromNetplanPayload(
          networkEthernetConfiguration
        );

        this._interfaces[networkEthernetName] = networkNetplanConfiguration;
      }
    }
  }

  /**
   * @description Method for getting content from file - returns null if there is no file
   */
  async _getContentFromFile() {
    //Exit stright away if there was no dir path specified
    if (!this.DirPath) return null;

    //Exit stright away if there was no file name
    if (!this.FileName) return null;

    //Exit stright away if dir does not exists
    let dirExists = await checkIfDirectoryExistsAsync(this.DirPath);
    if (!dirExists) return null;

    //Exit stright away if file does not exists
    let filePath = path.join(this.DirPath, this.FileName);
    let fileExists = await checkIfFileExistsAsync(filePath);
    if (!fileExists) return null;

    let yamlContent = await readFileAsync(filePath, "utf8");

    return convertYamlToJSON(yamlContent);
  }

  /**
   * @description Method for saving all configuration to netplan config file
   */
  async Save() {
    await this._saveInterfaces();
  }

  /**
   * @description Method for saving all interface configurations to config file
   */
  async _saveInterfaces() {
    let payload = this.NetplanPayload;
    let yamlPayload = convertJSONToYaml(payload);

    let filePath = path.join(this.DirPath, this.FileName);

    await writeFileAsync(filePath, yamlPayload, "utf8");
  }

  /**
   * @description Method for applying changes to netplan - calls command "netplan appy"
   */
  async ApplyChanges() {
    await execAsync("netplan apply");
  }

  /**
   * @description Payload of netplan file in JSON
   */
  get NetplanPayload() {
    let payloadToReturn = {
      network: {
        version: 2,
        ethernets: {},
      },
    };

    for (let netInterface of Object.values(this.Interfaces)) {
      payloadToReturn.network.ethernets[netInterface.Name] =
        netInterface.NetplanPayload;
    }

    return payloadToReturn;
  }

  /**
   * @description Payload of configuration object
   */
  get Payload() {
    let payloadToReturn = {
      dirPath: this.DirPath,
      fileName: this.FileName,
      interfaces: Object.values(this.Interfaces).map(
        (netInterface) => netInterface.Payload
      ),
    };
    return payloadToReturn;
  }

  /**
   * @description Method for validation if given payload is a valid netplan configurator payload
   * @param {JSON} payload Payload to check
   */
  _validatePayload(payload) {
    return NetplanConfiguratorSchema.validate(payload, {
      abortEarly: true,
    });
  }

  /**
   * @description Method for updating netplan configuration - DOES NOT CHANGE NETPLAN FILE AUTOMATICALLY, Throws if payload is invalid
   * @param {JSON} payload Payload to check
   */
  Update(payload) {
    let validationResult = this._validatePayload(payload);
    if (validationResult.error) throw new Error(validationResult.error.message);

    let validatedPayload = validationResult.value;

    this._dirPath = validatedPayload.dirPath;
    this._fileName = validatedPayload.fileName;
    this._interfaces = {};

    for (let netInterPayload of validatedPayload.interfaces) {
      let netInter = new NetplanInterfaceConfiguration(netInterPayload.name);
      netInter.InitFromPayload(netInterPayload);
      this._interfaces[netInter.Name] = netInter;
    }
  }
}

module.exports.NetplanConfigurator = NetplanConfigurator;
module.exports.NetplanConfiguratorSchema = NetplanConfiguratorSchema;
