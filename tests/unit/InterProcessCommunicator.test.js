const config = require("config");
const path = require("path");
const appAuthToken = config.get("appAuthToken");
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
  sendHTTPPostToSocket,
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

  describe("onDataInput", () => {
    let message1JSONContent;
    let message1Content;
    let message2JSONContent;
    let message2Content;
    let message3JSONContent;
    let message3Content;
    let interProcessCommunicator;
    let onDataInputMockFunc;
    let onDataInputResolvedValue;
    let sendData1;
    let sendHeaders1;
    let sendData2;
    let sendHeaders2;
    let sendData3;
    let sendHeaders3;
    let sendDataResult1;
    let sendDataResult2;
    let sendDataResult3;

    beforeEach(() => {
      sendData1 = true;
      message1JSONContent = {
        abcd: 1234,
        defg: "hjkl",
      };
      message1Content = JSON.stringify(message1JSONContent);
      sendHeaders1 = {
        "x-auth-token": appAuthToken,
        "content-type": "application/json",
      };
      sendDataResult1 = null;

      sendData2 = true;
      message2JSONContent = {
        abcda: 12345,
        defgd: "hjkle",
      };
      message2Content = JSON.stringify(message2JSONContent);
      sendHeaders2 = {
        "x-auth-token": appAuthToken,
        "content-type": "application/json",
      };
      sendDataResult2 = null;

      sendData3 = true;
      message3JSONContent = {
        abcda: 123455,
        defgd: "hjklea",
      };
      message3Content = JSON.stringify(message3JSONContent);
      sendHeaders3 = {
        "x-auth-token": appAuthToken,
        "content-type": "application/json",
      };
      sendDataResult3 = null;

      interProcessCommunicator = new InterProcessCommunicator();

      onDataInputResolvedValue = {
        test1: "abcd1234",
        test2: "abcd",
        test3: 1234,
      };

      onDataInputMockFunc = jest
        .fn()
        .mockResolvedValue(onDataInputResolvedValue);
    });

    afterEach(async () => {
      if (interProcessCommunicator.ComServer)
        await interProcessCommunicator.ComServer.close();
    });

    let exec = async () => {
      interProcessCommunicator.OnDataInput = onDataInputMockFunc;
      await interProcessCommunicator.start();

      if (sendData1)
        sendDataResult1 = await sendHTTPPostToSocket(
          socketFilePath,
          "/",
          sendHeaders1,
          message1Content
        );
      if (sendData2)
        sendDataResult2 = await sendHTTPPostToSocket(
          socketFilePath,
          "/",
          sendHeaders2,
          message2Content
        );
      if (sendData3)
        sendDataResult3 = await sendHTTPPostToSocket(
          socketFilePath,
          "/",
          sendHeaders3,
          message3Content
        );
    };

    it("should call OnDataInput if other process sends data - and send back OnDataInputResult", async () => {
      await exec();

      expect(onDataInputMockFunc).toHaveBeenCalledTimes(3);

      expect(onDataInputMockFunc.mock.calls[0][0]).toEqual(message1JSONContent);
      expect(onDataInputMockFunc.mock.calls[1][0]).toEqual(message2JSONContent);
      expect(onDataInputMockFunc.mock.calls[2][0]).toEqual(message3JSONContent);

      expect(sendDataResult1).toBeDefined();
      let result1 = JSON.parse(sendDataResult1);
      expect(result1).toEqual(onDataInputResolvedValue);

      expect(sendDataResult2).toBeDefined();
      let result2 = JSON.parse(sendDataResult2);
      expect(result2).toEqual(onDataInputResolvedValue);

      expect(sendDataResult3).toBeDefined();
      let result3 = JSON.parse(sendDataResult3);
      expect(result3).toEqual(onDataInputResolvedValue);
    });

    it("should call OnDataInput if other process sends data - and send back OnDataInputResult - even if OnDataInput return empty object", async () => {
      onDataInputResolvedValue = {};

      onDataInputMockFunc = jest
        .fn()
        .mockResolvedValue(onDataInputResolvedValue);

      await exec();

      expect(onDataInputMockFunc).toHaveBeenCalledTimes(3);

      expect(onDataInputMockFunc.mock.calls[0][0]).toEqual(message1JSONContent);
      expect(onDataInputMockFunc.mock.calls[1][0]).toEqual(message2JSONContent);
      expect(onDataInputMockFunc.mock.calls[2][0]).toEqual(message3JSONContent);

      expect(sendDataResult1).toBeDefined();
      let result1 = JSON.parse(sendDataResult1);
      expect(result1).toEqual(onDataInputResolvedValue);

      expect(sendDataResult2).toBeDefined();
      let result2 = JSON.parse(sendDataResult2);
      expect(result2).toEqual(onDataInputResolvedValue);

      expect(sendDataResult3).toBeDefined();
      let result3 = JSON.parse(sendDataResult3);
      expect(result3).toEqual(onDataInputResolvedValue);
    });

    it("should call OnDataInput if other process sends data - and send back OnDataInputResult - even if OnDataInput returns null", async () => {
      onDataInputMockFunc = jest.fn().mockResolvedValue(null);

      await exec();

      expect(onDataInputMockFunc).toHaveBeenCalledTimes(3);

      expect(onDataInputMockFunc.mock.calls[0][0]).toEqual(message1JSONContent);
      expect(onDataInputMockFunc.mock.calls[1][0]).toEqual(message2JSONContent);
      expect(onDataInputMockFunc.mock.calls[2][0]).toEqual(message3JSONContent);

      expect(sendDataResult1).toBeDefined();
      expect(sendDataResult1).toEqual("null");

      expect(sendDataResult2).toBeDefined();
      expect(sendDataResult2).toEqual("null");

      expect(sendDataResult3).toBeDefined();
      expect(sendDataResult3).toEqual("null");
    });

    it("should call OnDataInput if other process sends data - and send back OnDataInputResult - even if OnDataInput returns nothing", async () => {
      onDataInputMockFunc = jest.fn().mockResolvedValue();

      await exec();

      expect(onDataInputMockFunc).toHaveBeenCalledTimes(3);

      expect(onDataInputMockFunc.mock.calls[0][0]).toEqual(message1JSONContent);
      expect(onDataInputMockFunc.mock.calls[1][0]).toEqual(message2JSONContent);
      expect(onDataInputMockFunc.mock.calls[2][0]).toEqual(message3JSONContent);

      expect(sendDataResult1).toBeDefined();
      expect(sendDataResult1).toEqual("");

      expect(sendDataResult2).toBeDefined();
      expect(sendDataResult2).toEqual("");

      expect(sendDataResult3).toBeDefined();
      expect(sendDataResult3).toEqual("");
    });

    it("should call OnDataInput and not throw - even if start is called multiple times", async () => {
      await interProcessCommunicator.start();
      await interProcessCommunicator.start();
      await interProcessCommunicator.start();
      await exec();

      expect(onDataInputMockFunc).toHaveBeenCalledTimes(3);

      expect(onDataInputMockFunc.mock.calls[0][0]).toEqual(message1JSONContent);
      expect(onDataInputMockFunc.mock.calls[1][0]).toEqual(message2JSONContent);
      expect(onDataInputMockFunc.mock.calls[2][0]).toEqual(message3JSONContent);
    });

    it("should call OnDataInput if other process sends data - even if socket file already exists", async () => {
      await writeFileAsync(socketFilePath, "fakeContent");

      await exec();

      expect(onDataInputMockFunc).toHaveBeenCalledTimes(3);

      expect(onDataInputMockFunc.mock.calls[0][0]).toEqual(message1JSONContent);
      expect(onDataInputMockFunc.mock.calls[1][0]).toEqual(message2JSONContent);
      expect(onDataInputMockFunc.mock.calls[2][0]).toEqual(message3JSONContent);

      expect(sendDataResult1).toEqual(JSON.stringify(onDataInputResolvedValue));
      expect(sendDataResult2).toEqual(JSON.stringify(onDataInputResolvedValue));
      expect(sendDataResult3).toEqual(JSON.stringify(onDataInputResolvedValue));
    });

    // // //SHOULD BE TESTED MANUALLY!!
    // // //Cannot be tested automatically - due to simultaneous acces to UNIX Socket with the same process (client + server) multiple times while sending parts of data
    // // it("should call OnDataInput if other process sends data - even if message is very long", async () => {
    // //   message1JSONContent = {
    // //     test: [],
    // //   };
    // //   for (let i = 0; i <= 1000000; i++) {
    // //     message1JSONContent.test.push(i);
    // //   }
    // //   message1Content = JSON.stringify(message1JSONContent);

    // //   await exec();

    // //   expect(onDataInputMockFunc).toHaveBeenCalledTimes(1);

    // //   expect(onDataInputMockFunc.mock.calls[0][0]).toEqual(message1JSONContent);
    // //   expect(onDataInputMockFunc.mock.calls[1][0]).toEqual(message2JSONContent);
    // //   expect(onDataInputMockFunc.mock.calls[2][0]).toEqual(message3JSONContent);
    // // });

    it("should call OnDataInput if other process sends data - but one of sending was invalid due to token", async () => {
      sendHeaders2["x-auth-token"] = "fakeToken";

      await exec();

      expect(onDataInputMockFunc).toHaveBeenCalledTimes(2);

      expect(onDataInputMockFunc.mock.calls[0][0]).toEqual(message1JSONContent);
      expect(onDataInputMockFunc.mock.calls[1][0]).toEqual(message3JSONContent);

      expect(sendDataResult1).toEqual(JSON.stringify(onDataInputResolvedValue));
      expect(sendDataResult2).toEqual("Access forbidden.");
      expect(sendDataResult3).toEqual(JSON.stringify(onDataInputResolvedValue));
    });

    it("should call OnDataInput if other process sends data - but one sends empty data", async () => {
      message2Content = "{}";

      await exec();

      expect(onDataInputMockFunc).toHaveBeenCalledTimes(3);

      expect(onDataInputMockFunc.mock.calls[0][0]).toEqual(message1JSONContent);
      expect(onDataInputMockFunc.mock.calls[1][0]).toEqual({});
      expect(onDataInputMockFunc.mock.calls[2][0]).toEqual(message3JSONContent);

      expect(sendDataResult1).toEqual(JSON.stringify(onDataInputResolvedValue));
      expect(sendDataResult2).toEqual(JSON.stringify(onDataInputResolvedValue));
      expect(sendDataResult3).toEqual(JSON.stringify(onDataInputResolvedValue));
    });

    it("should call OnDataInput if other process sends data - but one sends empty data", async () => {
      message2Content = "";

      await exec();

      expect(onDataInputMockFunc).toHaveBeenCalledTimes(2);

      expect(onDataInputMockFunc.mock.calls[0][0]).toEqual(message1JSONContent);
      expect(onDataInputMockFunc.mock.calls[1][0]).toEqual(message3JSONContent);

      expect(sendDataResult1).toEqual(JSON.stringify(onDataInputResolvedValue));
      expect(sendDataResult2).toEqual("Invalid data format.");
      expect(sendDataResult3).toEqual(JSON.stringify(onDataInputResolvedValue));
    });

    it("should call OnDataInput if other process sends data - but one sends null data", async () => {
      message2Content = null;

      await exec();

      expect(onDataInputMockFunc).toHaveBeenCalledTimes(2);

      expect(onDataInputMockFunc.mock.calls[0][0]).toEqual(message1JSONContent);
      expect(onDataInputMockFunc.mock.calls[1][0]).toEqual(message3JSONContent);

      expect(sendDataResult1).toEqual(JSON.stringify(onDataInputResolvedValue));
      expect(sendDataResult2).toEqual("Invalid data format.");
      expect(sendDataResult3).toEqual(JSON.stringify(onDataInputResolvedValue));
    });

    it("should call OnDataInput if other process sends data - but one sends undefined data", async () => {
      message2Content = undefined;

      await exec();

      expect(onDataInputMockFunc).toHaveBeenCalledTimes(2);

      expect(onDataInputMockFunc.mock.calls[0][0]).toEqual(message1JSONContent);
      expect(onDataInputMockFunc.mock.calls[1][0]).toEqual(message3JSONContent);

      expect(sendDataResult1).toEqual(JSON.stringify(onDataInputResolvedValue));
      expect(sendDataResult2).toEqual("Invalid data format.");
      expect(sendDataResult3).toEqual(JSON.stringify(onDataInputResolvedValue));
    });

    it("should call OnDataInput if other process sends data - but one of sending was invalid due to message (string instead of JSON)", async () => {
      message2Content = "fakeMessage";

      await exec();

      expect(onDataInputMockFunc).toHaveBeenCalledTimes(2);

      expect(onDataInputMockFunc.mock.calls[0][0]).toEqual(message1JSONContent);
      expect(onDataInputMockFunc.mock.calls[1][0]).toEqual(message3JSONContent);

      expect(sendDataResult1).toEqual(JSON.stringify(onDataInputResolvedValue));
      expect(sendDataResult2).toEqual("Invalid data format.");
      expect(sendDataResult3).toEqual(JSON.stringify(onDataInputResolvedValue));
    });

    it("should call OnDataInput if other process sends data - but one of sending was invalid due to message (Invalid JSON)", async () => {
      message2Content = "{ abcd : fakeMessage }";

      await exec();

      expect(onDataInputMockFunc).toHaveBeenCalledTimes(2);

      expect(onDataInputMockFunc.mock.calls[0][0]).toEqual(message1JSONContent);
      expect(onDataInputMockFunc.mock.calls[1][0]).toEqual(message3JSONContent);

      expect(sendDataResult1).toEqual(JSON.stringify(onDataInputResolvedValue));
      expect(sendDataResult2).toEqual("Invalid data format.");
      expect(sendDataResult3).toEqual(JSON.stringify(onDataInputResolvedValue));
    });

    it("should call OnDataInput if other process sends data - but one of sending was invalid due to content type header", async () => {
      sendHeaders2["content-type"] = "fakeType";

      await exec();

      expect(onDataInputMockFunc).toHaveBeenCalledTimes(2);

      expect(onDataInputMockFunc.mock.calls[0][0]).toEqual(message1JSONContent);
      expect(onDataInputMockFunc.mock.calls[1][0]).toEqual(message3JSONContent);

      expect(sendDataResult1).toEqual(JSON.stringify(onDataInputResolvedValue));
      expect(sendDataResult2).toEqual("Invalid data format.");
      expect(sendDataResult3).toEqual(JSON.stringify(onDataInputResolvedValue));
    });

    it("should call OnDataInput if other process sends data - but one of sending was invalid due to lack of content type", async () => {
      delete sendHeaders2["content-type"];

      await exec();

      expect(onDataInputMockFunc).toHaveBeenCalledTimes(2);

      expect(onDataInputMockFunc.mock.calls[0][0]).toEqual(message1JSONContent);
      expect(onDataInputMockFunc.mock.calls[1][0]).toEqual(message3JSONContent);

      expect(sendDataResult1).toEqual(JSON.stringify(onDataInputResolvedValue));
      expect(sendDataResult2).toEqual("Invalid data format.");
      expect(sendDataResult3).toEqual(JSON.stringify(onDataInputResolvedValue));
    });

    it("should call OnDataInput if other process sends data - but OnDataInput throws during one invoke", async () => {
      let invokeIndex = 0;
      onDataInputMockFunc = jest.fn(() => {
        if (invokeIndex === 1) throw new Error("test error");
        invokeIndex++;
      });

      await exec();

      expect(onDataInputMockFunc).toHaveBeenCalledTimes(3);

      expect(onDataInputMockFunc.mock.calls[0][0]).toEqual(message1JSONContent);
      expect(onDataInputMockFunc.mock.calls[1][0]).toEqual(message2JSONContent);
      expect(onDataInputMockFunc.mock.calls[2][0]).toEqual(message3JSONContent);

      expect(sendDataResult1).toEqual("");
      expect(sendDataResult2).toEqual("");
      expect(sendDataResult3).toEqual("");
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
      await sendHTTPPostToSocket(
        socketFilePath,
        "/",
        sendHeaders1,
        message1Content
      );
      expect(onDataInputMockFunc).toHaveBeenCalledTimes(1);

      expect(onDataInputMockFunc.mock.calls[0][0]).toEqual(message1JSONContent);
    });

    it("should not call OnDataInput if other process sends data but token is invalid", async () => {
      sendHeaders1["x-auth-token"] = "fakeToken";

      sendData2 = false;
      sendData3 = false;

      await exec();

      expect(onDataInputMockFunc).not.toHaveBeenCalled();

      expect(sendDataResult1).toEqual("Access forbidden.");
    });

    it("should not call OnDataInput if other process sends data but token in empty", async () => {
      delete sendHeaders1["x-auth-token"];

      sendData2 = false;
      sendData3 = false;

      await exec();

      expect(onDataInputMockFunc).not.toHaveBeenCalled();

      expect(sendDataResult1).toEqual("Access forbidden.");
    });

    it("should not call OnDataInput if other process sends data but token null", async () => {
      sendHeaders1["x-auth-token"] = null;

      sendData2 = false;
      sendData3 = false;

      await exec();

      expect(onDataInputMockFunc).not.toHaveBeenCalled();

      expect(sendDataResult1).toEqual("Access forbidden.");
    });
  });

  //TODO - add onDataOutput test
});
