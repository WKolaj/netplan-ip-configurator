const {
  InterProcessCommunicator,
} = require("../classes/InterProcessCommunicator/InterProcessCommunicator");
const {
  NetplanConfiguratorSchema,
} = require("../classes/NetplanConfigurator/NetplanConfigurator");
const netplanService = require("./netplanService");
const _ = require("lodash");

let interProcessCommunicator = null;

const validateInput = (inputPayload) => {
  let validationResult = NetplanConfiguratorSchema.validate(inputPayload, {
    abortEarly: true,
  });
  if (validationResult.error) throw new Error(validationResult.error.message);

  let validatedPayload = validationResult.value;

  return validatedPayload;
};

const handleDataInput = async (data) => {
  try {
    let initialPayload = await netplanService.getSettings();
    initialPayload.interfaces = data;

    let payloadAfterValidation = validateInput(initialPayload);

    let result = await netplanService.changeSettings(payloadAfterValidation);
    return { code: 200, message: result.interfaces };
  } catch (err) {
    return { code: 400, message: "Invalid data format" };
  }
};

const getOutputPayload = (netplanSettings) => {
  if (netplanSettings.interfaces) return netplanSettings.interfaces;
  else return [];
};

const handleDataOutput = async () => {
  try {
    let settings = await netplanService.getSettings();
    return { code: 200, message: getOutputPayload(settings) };
  } catch (err) {
    return { code: 500, message: "Ups... an error occured" };
  }
};

module.exports.init = async () => {
  //Return immidiately if initialized several times
  if (interProcessCommunicator) return;

  interProcessCommunicator = new InterProcessCommunicator();

  interProcessCommunicator.OnDataInput = handleDataInput;
  interProcessCommunicator.OnDataOutput = handleDataOutput;

  await interProcessCommunicator.start();
};

module.exports.stopAndDelete = async () => {
  //Return immidiately if initialized several times
  if (!interProcessCommunicator) return;
  await interProcessCommunicator.stop();

  interProcessCommunicator = null;
};
