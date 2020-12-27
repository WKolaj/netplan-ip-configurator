const {
  NetplanConfigurator,
} = require("../classes/NetplanConfigurator/NetplanConfigurator");
const config = require("config");

let netplanConfigurator = null;

module.exports.init = async () => {
  //Return imediately if initialized
  if (netplanConfigurator) return;

  let netplanDirPath = config.get("netplanDirPath");
  let netplanFileName = config.get("netplanFileName");
  let netplanApplyCommand = config.get("netplanApplyCommand");

  netplanConfigurator = new NetplanConfigurator(
    netplanDirPath,
    netplanFileName,
    netplanApplyCommand
  );

  await netplanConfigurator.Load();
};

module.exports.changeSettings = async (payload) => {
  if (netplanConfigurator === null) return {};

  //Overriding file name and dir path
  payload.fileName = netplanConfigurator.FileName;
  payload.dirPath = netplanConfigurator.DirPath;

  netplanConfigurator.Update(payload);

  await netplanConfigurator.Save();

  await netplanConfigurator.ApplyChanges();

  return netplanConfigurator.Payload;
};

module.exports.getSettings = async () => {
  if (netplanConfigurator === null) return {};

  await netplanConfigurator.Load();

  return netplanConfigurator.Payload;
};
