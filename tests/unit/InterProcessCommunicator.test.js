const config = require("config");
const path = require("path");
const socketDirPath = config.get("socketDirPath");
const socketFileName = config.get("socketFileName");
const socketFilePath = path.join(socketDirPath, socketFileName);
const {
  clearDirectoryAsync,
  snooze,
  writeFileAsync,
} = require("../../utilities/utilities");
const {
  writeDataToStreamAndWaitForEnd,
  sendDataToSocket,
} = require("../utilities/testUtilities");
const {
  InterProcessCommunicator,
} = require("../../classes/InterProcessCommunicator/InterProcessCommunicator");
const net = require("net");

describe("InterProcessCommunicator", () => {
  beforeEach(async () => {
    //clearing socket communication directory
    await clearDirectoryAsync(socketDirPath);
  });

  afterEach(async () => {
    //clearing project directory
    await clearDirectoryAsync(socketDirPath);
  });

  describe("constructor", () => {
    let exec = () => {
      return new InterProcessCommunicator();
    };

    it("should initialize appropriate properties", () => {
      let result = exec();

      expect(result.SocketDirPath).toEqual(socketDirPath);
      expect(result.SocketFileName).toEqual(socketFileName);
      expect(result.SocketFilePath).toEqual(socketFilePath);
    });

    it("should set onDataInput as null at the begining", () => {
      let result = exec();

      expect(result.OnDataInput).toBeNull();
    });

    it("should set comServer as null at the begining", () => {
      let result = exec();

      expect(result.ComServer).toBeNull();
    });
  });

  describe("data event", () => {
    let message1JSONContent;
    let message1Content;
    let message2JSONContent;
    let message2Content;
    let message3JSONContent;
    let message3Content;
    let interProcessCommunicator;
    let onDataInputMockFunc;
    let sendData1;
    let sendData2;
    let sendData3;

    beforeEach(() => {
      sendData1 = true;
      message1JSONContent = {
        token: "testAppToken",
        message: {
          abcd: 1234,
          defg: "hjkl",
        },
      };
      message1Content = JSON.stringify(message1JSONContent);

      sendData2 = true;
      message2JSONContent = {
        token: "testAppToken",
        message: {
          abcda: 12345,
          defgd: "hjkle",
        },
      };
      message2Content = JSON.stringify(message2JSONContent);

      sendData3 = true;
      message3JSONContent = {
        token: "testAppToken",
        message: {
          abcda: 123455,
          defgd: "hjklea",
        },
      };
      message3Content = JSON.stringify(message3JSONContent);

      interProcessCommunicator = new InterProcessCommunicator();

      onDataInputMockFunc = jest.fn();
    });

    afterEach(async () => {
      if (interProcessCommunicator.ComServer)
        await interProcessCommunicator.ComServer.close();
    });

    let exec = async () => {
      interProcessCommunicator.OnDataInput = onDataInputMockFunc;
      await interProcessCommunicator.start();

      if (sendData1) await sendDataToSocket(socketFilePath, message1Content);
      if (sendData2) await sendDataToSocket(socketFilePath, message2Content);
      if (sendData3) await sendDataToSocket(socketFilePath, message3Content);

      //waiting for stream events to be fired
      await snooze(100);
    };

    it("should call OnDataInput if other process sends data", async () => {
      await exec();

      expect(onDataInputMockFunc).toHaveBeenCalledTimes(3);

      expect(onDataInputMockFunc.mock.calls[0][0]).toEqual(
        message1JSONContent.message
      );
      expect(onDataInputMockFunc.mock.calls[1][0]).toEqual(
        message2JSONContent.message
      );
      expect(onDataInputMockFunc.mock.calls[2][0]).toEqual(
        message3JSONContent.message
      );
    });

    it("should call OnDataInput and not throw - even if start is called multiple times", async () => {
      await interProcessCommunicator.start();
      await interProcessCommunicator.start();
      await interProcessCommunicator.start();
      await exec();

      expect(onDataInputMockFunc).toHaveBeenCalledTimes(3);

      expect(onDataInputMockFunc.mock.calls[0][0]).toEqual(
        message1JSONContent.message
      );
      expect(onDataInputMockFunc.mock.calls[1][0]).toEqual(
        message2JSONContent.message
      );
      expect(onDataInputMockFunc.mock.calls[2][0]).toEqual(
        message3JSONContent.message
      );
    });

    it("should call OnDataInput if other process sends data - even if socket file already exists", async () => {
      await writeFileAsync(socketFilePath, "fakeContent");

      await exec();

      expect(onDataInputMockFunc).toHaveBeenCalledTimes(3);

      expect(onDataInputMockFunc.mock.calls[0][0]).toEqual(
        message1JSONContent.message
      );
      expect(onDataInputMockFunc.mock.calls[1][0]).toEqual(
        message2JSONContent.message
      );
      expect(onDataInputMockFunc.mock.calls[2][0]).toEqual(
        message3JSONContent.message
      );
    });

    it("should call OnDataInput if other process sends data - even if message is very long", async () => {
      message1JSONContent = {
        token: "testAppToken",
        message: {
          test: [],
        },
      };
      for (let i = 0; i <= 1000000; i++) {
        message1JSONContent.message.test.push(i);
      }
      message1Content = JSON.stringify(message1JSONContent);

      await writeFileAsync(socketFilePath, "fakeContent");

      await exec();

      expect(onDataInputMockFunc).toHaveBeenCalledTimes(3);

      expect(onDataInputMockFunc.mock.calls[0][0]).toEqual(
        message1JSONContent.message
      );
      expect(onDataInputMockFunc.mock.calls[1][0]).toEqual(
        message2JSONContent.message
      );
      expect(onDataInputMockFunc.mock.calls[2][0]).toEqual(
        message3JSONContent.message
      );
    });

    it("should call OnDataInput if other process sends data - but one of sending was invalid due to token", async () => {
      message2JSONContent.token = "fakeToken";
      message2Content = JSON.stringify(message2JSONContent);

      await exec();

      expect(onDataInputMockFunc).toHaveBeenCalledTimes(2);

      expect(onDataInputMockFunc.mock.calls[0][0]).toEqual(
        message1JSONContent.message
      );
      expect(onDataInputMockFunc.mock.calls[1][0]).toEqual(
        message3JSONContent.message
      );
    });

    it("should call OnDataInput if other process sends data - but one of sending was invalid due to message", async () => {
      message2JSONContent.message = "fakeMessage";
      message2Content = JSON.stringify(message2JSONContent);

      await exec();

      expect(onDataInputMockFunc).toHaveBeenCalledTimes(2);

      expect(onDataInputMockFunc.mock.calls[0][0]).toEqual(
        message1JSONContent.message
      );
      expect(onDataInputMockFunc.mock.calls[1][0]).toEqual(
        message3JSONContent.message
      );
    });

    it("should call OnDataInput if other process sends data - but one of sending was invalid due to whole message", async () => {
      message2Content = "fakeMessage";

      await exec();

      expect(onDataInputMockFunc).toHaveBeenCalledTimes(2);

      expect(onDataInputMockFunc.mock.calls[0][0]).toEqual(
        message1JSONContent.message
      );
      expect(onDataInputMockFunc.mock.calls[1][0]).toEqual(
        message3JSONContent.message
      );
    });

    it("should call OnDataInput if other process sends data - but OnDataInput throws during one invoke", async () => {
      let invokeIndex = 0;
      onDataInputMockFunc = jest.fn(() => {
        if (invokeIndex === 1) throw new Error("test error");
        invokeIndex++;
      });

      await exec();

      expect(onDataInputMockFunc).toHaveBeenCalledTimes(3);

      expect(onDataInputMockFunc.mock.calls[0][0]).toEqual(
        message1JSONContent.message
      );
      expect(onDataInputMockFunc.mock.calls[1][0]).toEqual(
        message2JSONContent.message
      );
      expect(onDataInputMockFunc.mock.calls[2][0]).toEqual(
        message3JSONContent.message
      );
    });

    it("should not call OnDataInput if other process does not send any data", async () => {
      sendData1 = false;
      sendData2 = false;
      sendData3 = false;

      await exec();

      expect(onDataInputMockFunc).not.toHaveBeenCalled();
    });

    it("should not throw if OnDataInput is not defined", async () => {
      onDataInputMockFunc = null;

      await exec();

      onDataInputMockFunc = jest.fn();

      //Assinging onDataInputFunc and sending data again
      interProcessCommunicator.OnDataInput = onDataInputMockFunc;

      await sendDataToSocket(socketFilePath, message1Content);

      //waiting for stream events to be fired
      await snooze(100);

      expect(onDataInputMockFunc).toHaveBeenCalledTimes(1);

      expect(onDataInputMockFunc.mock.calls[0][0]).toEqual(
        message1JSONContent.message
      );
    });

    it("should not call OnDataInput if message is invalid JSON", async () => {
      message1JSONContent.token = "fakeToken";
      message1Content = "invalidJSON";

      sendData2 = false;
      sendData3 = false;
      await exec();

      expect(onDataInputMockFunc).not.toHaveBeenCalled();
    });

    it("should not call OnDataInput if other process sends data but token is invalid", async () => {
      message1JSONContent.token = "fakeToken";
      message1Content = JSON.stringify(message1JSONContent);

      sendData2 = false;
      sendData3 = false;

      await exec();

      expect(onDataInputMockFunc).not.toHaveBeenCalled();
    });

    it("should not call OnDataInput if other process sends data but token in empty", async () => {
      delete message1JSONContent.token;
      message1Content = JSON.stringify(message1JSONContent);

      sendData2 = false;
      sendData3 = false;

      await exec();

      expect(onDataInputMockFunc).not.toHaveBeenCalled();
    });

    it("should not call OnDataInput if other process sends data but token null", async () => {
      message1JSONContent.token = null;
      message1Content = JSON.stringify(message1JSONContent);

      sendData2 = false;
      sendData3 = false;

      await exec();

      expect(onDataInputMockFunc).not.toHaveBeenCalled();
    });

    it("should not call OnDataInput if other process sends data but message is not a valid JSON", async () => {
      message1JSONContent.message = "abcd1234";
      message1Content = JSON.stringify(message1JSONContent);

      sendData2 = false;
      sendData3 = false;

      await exec();

      expect(onDataInputMockFunc).not.toHaveBeenCalled();
    });

    it("should not call OnDataInput if other process sends data but message is not defined", async () => {
      delete message1JSONContent.message;
      message1Content = JSON.stringify(message1JSONContent);

      sendData2 = false;
      sendData3 = false;

      await exec();

      expect(onDataInputMockFunc).not.toHaveBeenCalled();
    });

    it("should not call OnDataInput if other process sends data but message is null", async () => {
      message1JSONContent.message = null;
      message1Content = JSON.stringify(message1JSONContent);

      sendData2 = false;
      sendData3 = false;

      await exec();

      expect(onDataInputMockFunc).not.toHaveBeenCalled();
    });
  });
});
