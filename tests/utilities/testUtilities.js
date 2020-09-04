const { User } = require("../../models/user");
const {
  exists,
  hashString,
  generateRandomNumberString,
} = require("../../utilities/utilities");

const testUselessUserEmail = "useless@test1234abcd.com.pl";
const testAdminEmail = "admin@test1234abcd.com.pl";
const testUserEmail = "user@test1234abcd.com.pl";
const testUserAndAdminEmail = "userAndAdmin@test1234abcd.com.pl";
const testSuperAdminEmail = "superAdmin@test1234abcd.com.pl";
const testAdminAndSuperAdminEmail = "superAdminAndAdmin@test1234abcd.com.pl";
const testUserAndAdminAndSuperAdminEmail =
  "userAndSuperAdminAndAdmin@test1234abcd.com.pl";

const testUselessUserPassword = "testUselessUserPassword";
const testAdminPassword = "testAdminPassword";
const testUserPassword = "testUserPassword";
const testUserAndAdminPassword = "testUserAndAdminPassword";
const testSuperAdminPassword = "testSuperAdminPassword";
const testAdminAndSuperAdminPassword = "superAdminAndAdminPassword";
const testUserAndAdminAndSuperAdminPassword =
  "userAndSuperAdminAndAdminPassword";

module.exports.testUselessUserEmail = testUselessUserEmail;
module.exports.testAdminEmail = testAdminEmail;
module.exports.testUserEmail = testUserEmail;
module.exports.testUserAndAdminEmail = testUserAndAdminEmail;
module.exports.testSuperAdminEmail = testSuperAdminEmail;
module.exports.testAdminAndSuperAdminEmail = testAdminAndSuperAdminEmail;
module.exports.testUserAndAdminAndSuperAdminEmail = testUserAndAdminAndSuperAdminEmail;

module.exports.testUselessUserPassword = testUselessUserPassword;
module.exports.testAdminPassword = testAdminPassword;
module.exports.testUserPassword = testUserPassword;
module.exports.testUserAndAdminPassword = testUserAndAdminPassword;
module.exports.testSuperAdminPassword = testSuperAdminPassword;
module.exports.testAdminAndSuperAdminPassword = testAdminAndSuperAdminPassword;
module.exports.testUserAndAdminAndSuperAdminPassword = testUserAndAdminAndSuperAdminPassword;

//Method for generating useless (without permissions) user directly into database
module.exports.generateUselessUser = async () => {
  let user = await User.findOne({ email: testUselessUserEmail });
  if (exists(user)) return user;

  user = new User({
    name: "testUselessUser",
    email: testUselessUserEmail,
    password: await hashString(testUselessUserPassword),
    permissions: 0,
  });

  await user.save();

  return user;
};

//Method for generating test admin user directly into database
module.exports.generateTestAdmin = async () => {
  let admin = await User.findOne({ email: testAdminEmail });
  if (exists(admin)) return admin;

  admin = new User({
    name: "testAdmin",
    email: testAdminEmail,
    password: await hashString(testAdminPassword),
    permissions: 2,
  });

  await admin.save();

  return admin;
};

//Method for generating test  user directly into database
module.exports.generateTestUser = async () => {
  let user = await User.findOne({ email: testUserEmail });
  if (exists(user)) return user;

  user = new User({
    name: "testUser",
    email: testUserEmail,
    password: await hashString(testUserPassword),
    permissions: 1,
  });

  await user.save();

  return user;
};

//Method for generating test user that is also an admin directly into database
module.exports.generateTestAdminAndUser = async () => {
  let user = await User.findOne({ email: testUserAndAdminEmail });
  if (exists(user)) return user;

  user = new User({
    name: "testUserAndAdmin",
    email: testUserAndAdminEmail,
    password: await hashString(testUserAndAdminPassword),
    permissions: 3,
  });

  await user.save();

  return user;
};

//Method for generating test su[er admin user directly into database
module.exports.generateTestSuperAdmin = async () => {
  let admin = await User.findOne({ email: testSuperAdminEmail });
  if (exists(admin)) return admin;

  admin = new User({
    name: "testSuperAdmin",
    email: testSuperAdminEmail,
    password: await hashString(testSuperAdminPassword),
    permissions: 4,
  });

  await admin.save();

  return admin;
};

//Method for generating test admin that is also a super admin
module.exports.generateTestAdminAndSuperAdmin = async () => {
  let user = await User.findOne({ email: testAdminAndSuperAdminEmail });
  if (exists(user)) return user;

  user = new User({
    name: "testAdminAndSuperAdmin",
    email: testAdminAndSuperAdminEmail,
    password: await hashString(testAdminAndSuperAdminPassword),
    permissions: 6,
  });

  await user.save();

  return user;
};

//Method for generating test admin that is also a super admin and user
module.exports.generateTestUserAndAdminAndSuperAdmin = async () => {
  let user = await User.findOne({ email: testUserAndAdminAndSuperAdminEmail });
  if (exists(user)) return user;

  user = new User({
    name: "testuserAndAdminAndSuperAdmin",
    email: testUserAndAdminAndSuperAdminEmail,
    password: await hashString(testUserAndAdminAndSuperAdminPassword),
    permissions: 7,
  });

  await user.save();

  return user;
};

//Method for generating string of given length
module.exports.generateStringOfGivenLength = (sign, length) => {
  return new Array(length + 1).join(sign);
};
