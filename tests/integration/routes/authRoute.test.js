const { snooze } = require("../../../utilities/utilities");
const _ = require("lodash");
const request = require("supertest");
const bcrypt = require("bcrypt");
const config = require("config");
const jsonWebToken = require("jsonwebtoken");
const mongoose = require("mongoose");
let { User } = require("../../../models/user");
let {
  generateTestAdmin,
  generateTestUser,
  generateTestAdminAndUser,
  generateUselessUser,
  generateTestSuperAdmin,
  generateStringOfGivenLength,
} = require("../../utilities/testUtilities");
let server;
let logger = require("../../../logger/logger");

describe("api/auth", () => {
  let uselessUser;
  let testAdmin;
  let testUser;
  let testSuperAdmin;
  let logActionMock;

  beforeEach(async () => {
    server = await require("../../../startup/app")();

    //Clearing users in database before each test
    await User.deleteMany({});

    //generating uslessUser, user, admin and adminUser
    uselessUser = await generateUselessUser();
    testAdmin = await generateTestAdmin();
    testUser = await generateTestUser();
    testSuperAdmin = await generateTestSuperAdmin();

    //Overwriting logget action method
    logActionMock = jest.fn();
    logger.action = logActionMock;
  });

  afterEach(async () => {
    //Clearing users in database after each test
    await User.deleteMany({});

    await server.close();
  });

  describe("POST/", () => {
    let requestPayload;

    beforeEach(async () => {
      requestPayload = {
        email: "user@test1234abcd.com.pl",
        password: "testUserPassword",
      };
    });

    let exec = async () => {
      return request(server).post("/api/auth").send(requestPayload);
    };

    it("should return 200 if logging in was successful", async () => {
      let result = await exec();

      expect(result.status).toEqual(200);
    });

    it("should return payload of logged user if logging was succesfull", async () => {
      let result = await exec();

      expect(result.body).toBeDefined();

      let expectedBody = {
        _id: testUser.id,
        email: testUser.email,
        name: testUser.name,
        permissions: testUser.permissions,
      };

      expect(result.body).toEqual(expectedBody);
    });

    it("should return jwt for user in header if logging was succesfull", async () => {
      let result = await exec();

      expect(result.header["x-auth-token"]).toBeDefined();

      let expectedJWT = await testUser.generateJWT();

      expect(result.header["x-auth-token"]).toEqual(expectedJWT);
    });

    it("should call log action with info that user has logged in", async () => {
      let result = await exec();

      expect(logActionMock).toHaveBeenCalledTimes(1);

      expect(logActionMock.mock.calls[0][0]).toEqual(
        "User user@test1234abcd.com.pl logged in"
      );
    });

    //#region =========== INVALID EMAIL ===========

    it("should return 400 and not return jwt in header if users email is empty", async () => {
      delete requestPayload.email;

      let result = await exec();

      expect(result.status).toEqual(400);

      expect(result.text).toEqual('"email" is required');

      //Checking if there is no jwt in payload
      expect(result.header["x-auth-token"]).not.toBeDefined();

      //Logging action should not have been called
      expect(logActionMock).not.toHaveBeenCalled();
    });

    it("should return 400 and not return jwt in header if users email is null", async () => {
      requestPayload.email = null;

      let result = await exec();

      expect(result.status).toEqual(400);

      expect(result.text).toEqual('"email" must be a string');

      //Checking if there is no jwt in payload
      expect(result.header["x-auth-token"]).not.toBeDefined();

      //Logging action should not have been called
      expect(logActionMock).not.toHaveBeenCalled();
    });

    it("should return 400 and not return jwt in header if users email is not a valid string", async () => {
      requestPayload.email = 123;

      let result = await exec();

      expect(result.status).toEqual(400);

      expect(result.text).toEqual('"email" must be a string');

      //Checking if there is no jwt in payload
      expect(result.header["x-auth-token"]).not.toBeDefined();

      //Logging action should not have been called
      expect(logActionMock).not.toHaveBeenCalled();
    });

    it("should return 400 and not return jwt in header if users email is not a valid email", async () => {
      requestPayload.email = "fakeEmail";

      let result = await exec();

      expect(result.status).toEqual(400);

      expect(result.text).toEqual('"email" must be a valid email');

      //Checking if there is no jwt in payload
      expect(result.header["x-auth-token"]).not.toBeDefined();

      //Logging action should not have been called
      expect(logActionMock).not.toHaveBeenCalled();
    });

    it("should return 400 and not return jwt in header if there is no user of given email", async () => {
      requestPayload.email = "fakeEmail@mail.com";

      let result = await exec();

      expect(result.status).toEqual(400);

      expect(result.text).toEqual("Invalid email or password");

      //Checking if there is no jwt in payload
      expect(result.header["x-auth-token"]).not.toBeDefined();

      //Logging action should not have been called
      expect(logActionMock).not.toHaveBeenCalled();
    });

    //#endregion =========== INVALID EMAIL ===========

    //#region =========== INVALID PASSWORD ===========

    it("should return 400 and not return jwt in header if users password is empty", async () => {
      delete requestPayload.password;

      let result = await exec();

      expect(result.status).toEqual(400);

      expect(result.text).toEqual('"password" is required');

      //Checking if there is no jwt in payload
      expect(result.header["x-auth-token"]).not.toBeDefined();

      //Logging action should not have been called
      expect(logActionMock).not.toHaveBeenCalled();
    });

    it("should return 400 and not return jwt in header if users password is null", async () => {
      requestPayload.password = null;

      let result = await exec();

      expect(result.status).toEqual(400);

      expect(result.text).toEqual('"password" must be a string');

      //Checking if there is no jwt in payload
      expect(result.header["x-auth-token"]).not.toBeDefined();

      //Logging action should not have been called
      expect(logActionMock).not.toHaveBeenCalled();
    });

    it("should return 400 and not return jwt in header if users password is not a valid string", async () => {
      requestPayload.password = 123;

      let result = await exec();

      expect(result.status).toEqual(400);

      expect(result.text).toEqual('"password" must be a string');

      //Checking if there is no jwt in payload
      expect(result.header["x-auth-token"]).not.toBeDefined();

      //Logging action should not have been called
      expect(logActionMock).not.toHaveBeenCalled();
    });

    it("should return 400 and not return jwt in header if users password is to short", async () => {
      requestPayload.password = generateStringOfGivenLength("a", 7);

      let result = await exec();

      expect(result.status).toEqual(400);

      expect(result.text).toEqual(
        '"password" length must be at least 8 characters long'
      );

      //Checking if there is no jwt in payload
      expect(result.header["x-auth-token"]).not.toBeDefined();

      //Logging action should not have been called
      expect(logActionMock).not.toHaveBeenCalled();
    });

    it("should return 400 and not return jwt in header if users password is too long", async () => {
      requestPayload.password = generateStringOfGivenLength("a", 101);

      let result = await exec();

      expect(result.status).toEqual(400);

      expect(result.text).toEqual(
        '"password" length must be less than or equal to 100 characters long'
      );

      //Checking if there is no jwt in payload
      expect(result.header["x-auth-token"]).not.toBeDefined();

      //Logging action should not have been called
      expect(logActionMock).not.toHaveBeenCalled();
    });

    it("should return 400 and not return jwt in header if users password is invalid", async () => {
      requestPayload.password = "fakeUserPassword";

      let result = await exec();

      expect(result.status).toEqual(400);

      expect(result.text).toEqual("Invalid email or password");

      //Checking if there is no jwt in payload
      expect(result.header["x-auth-token"]).not.toBeDefined();

      //Logging action should not have been called
      expect(logActionMock).not.toHaveBeenCalled();
    });

    //#endregion =========== INVALID PASSWORD ===========
  });
});
