const Joi = require("joi");
const {
  getIPAndSubnetMaskFromCidr: getIPAndGatewayFromCidr,
  getCidrFromIPAndSubnetMask,
} = require("../../utilities/utilities");

/**
 * @description Schema for ipV4 withouth cidr
 */
const ipV4Schema = Joi.string().ip({
  version: ["ipv4"],
  cidr: "forbidden",
});

/**
 * @description Schema for netplan interface configuration
 */
const NetplanInterfaceConfigurationSchema = Joi.object({
  name: Joi.string().min(1).required(),
  optional: Joi.boolean().required(),
  dhcp: Joi.boolean().required(),
  ipAddress: Joi.any().when("dhcp", {
    is: true,
    then: ipV4Schema.optional(),
    otherwise: ipV4Schema.required(),
  }),
  subnetMask: Joi.any().when("dhcp", {
    is: true,
    then: ipV4Schema.optional(),
    otherwise: ipV4Schema.required(),
  }),
  gateway: Joi.any().when("dhcp", {
    is: true,
    then: ipV4Schema.optional(),
    otherwise: ipV4Schema.required(),
  }),
  dns: Joi.any().when("dhcp", {
    is: true,
    then: Joi.array().items(ipV4Schema).optional(),
    otherwise: Joi.array().items(ipV4Schema).required(),
  }),
});

/**
 * @description Class representing Netplan Interface Configuration
 */
class NetplanInterfaceConfiguration {
  /**
   * @description Object representing Netplan Interface Configuration
   * @param {String} name Name of interface
   */
  constructor(name) {
    this._name = name;

    this._dhcp = true;
    this._ipAddress = "";
    this._subnetMask = "";
    this._gateway = "";
    this._optional = false;
    this._dns = [];
  }

  /**
   * @description Method for initializing Netplan Interface Configuration from interface config payload in netplan file
   * @param {JSON} interfaceConfigurationContent interface config payload in netplan file
   */
  initFromNetplanPayload(interfaceConfigurationContent) {
    if (interfaceConfigurationContent.dhcp4) this._dhcp = true;
    else this._dhcp = false;

    if (interfaceConfigurationContent.addresses) {
      let address = interfaceConfigurationContent.addresses[0];
      let { ipAddress, subnetMask } = getIPAndGatewayFromCidr(address);
      this._ipAddress = ipAddress;
      this._subnetMask = subnetMask;
    }

    if (interfaceConfigurationContent.gateway4) {
      this._gateway = interfaceConfigurationContent.gateway4;
    }

    if (
      interfaceConfigurationContent.nameservers &&
      interfaceConfigurationContent.nameservers.addresses
    ) {
      this._dns = interfaceConfigurationContent.nameservers.addresses;
    }

    if (interfaceConfigurationContent.optional) {
      this._optional = interfaceConfigurationContent.optional;
    }
  }

  /**
   * @description Method for initializing from payload
   * @param {JSON} payload Payload to initialize
   */
  initFromPayload(payload) {
    this.update(payload);
  }

  /**
   * @description Name of interface
   */
  get Name() {
    return this._name;
  }

  /**
   * @description Is DHCP on
   */
  get DHCP() {
    return this._dhcp;
  }

  /**
   * @description IPAddress of interface
   */
  get IPAddress() {
    return this._ipAddress;
  }

  /**
   * @description Subnet mask
   */
  get SubnetMask() {
    return this._subnetMask;
  }

  /**
   * @description Gateway
   */
  get Gateway() {
    return this._gateway;
  }

  /**
   * @description DNS addresses
   */
  get DNS() {
    return [...this._dns];
  }

  /**
   * @description is interface optional for cloud-init
   */
  get Optional() {
    return this._optional;
  }

  /**
   * @description Interface config payload in netplan file
   */
  get NetplanPayload() {
    let payloadToReturn = {
      dhcp4: this.DHCP,
      optional: this.Optional,
    };

    //If DHCP is on - there should not be any additional items
    if (this.DHCP) return payloadToReturn;

    if (
      this.IPAddress &&
      this.SubnetMask &&
      this.IPAddress != "" &&
      this.SubnetMask != ""
    ) {
      let cidr = getCidrFromIPAndSubnetMask(this.IPAddress, this.SubnetMask);
      payloadToReturn.addresses = [cidr];
    }

    if (this.Gateway && this.Gateway != "")
      payloadToReturn.gateway4 = this.Gateway;

    if (this.DNS && this.DNS.length > 0)
      payloadToReturn.nameservers = { addresses: [...this.DNS] };

    return payloadToReturn;
  }

  /**
   * @description Payload of netplan configuration
   */
  get Payload() {
    let payloadToReturn = {
      name: this.Name,
      dhcp: this.DHCP,
      optional: this.Optional,
    };

    if (this.DHCP) return payloadToReturn;

    payloadToReturn.ipAddress = this.IPAddress;
    payloadToReturn.subnetMask = this.SubnetMask;
    payloadToReturn.gateway = this.Gateway;
    payloadToReturn.dns = this.DNS;

    return payloadToReturn;
  }

  /**
   * @description Method for validating payload
   * @param {JSON} payload Payload to validate
   */
  _validatePayload(payload) {
    return NetplanInterfaceConfigurationSchema.validate(payload, {
      abortEarly: true,
    });
  }

  /**
   * @description Method for updating interface based on payload
   * @param {JSON} payload Payload to update interface
   */
  update(payload) {
    let validationResult = this._validatePayload(payload);
    if (validationResult.error) throw new Error(validationResult.error.message);

    let validatedPayload = validationResult.value;

    this._name = validatedPayload.name;
    this._dhcp = validatedPayload.dhcp;
    this._optional = validatedPayload.optional;
    this._ipAddress = "";
    this._gateway = "";
    this._subnetMask = "";
    this._dns = [];

    if (!validatedPayload.dhcp) {
      this._ipAddress = validatedPayload.ipAddress;
      this._gateway = validatedPayload.gateway;
      this._subnetMask = validatedPayload.subnetMask;
      this._dns = validatedPayload.dns;
    }
  }
}

module.exports.NetplanInterfaceConfiguration = NetplanInterfaceConfiguration;
module.exports.NetplanInterfaceConfigurationSchema = NetplanInterfaceConfigurationSchema;
