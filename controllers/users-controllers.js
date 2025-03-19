const { v4: uuidv4 } = require("uuid");
const { validationResult } = require("express-validator");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const HttpError = require("../models/http-error");
const User = require("../models/user");
const { uploadOnCloudinary } = require("../util/cloudinary");

const getUsers = async (req, res, next) => {
  let users;
  try {
    users = await User.find({}, "-password");
  } catch (err) {
    return next(
      new HttpError("Fetching Users Failed, please try again later...", 500)
    );
  }
  res.json({ users: users.map((user) => user.toObject({ getters: true })) });
};

const signup = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new HttpError("Invalid Inputs Please enter Correct Data", 422));
  }

  const { name, email, password } = req.body;

  try {
    existingUser = await User.findOne({ email: email });
  } catch (err) {
    const error = new HttpError(
      "Signing Up Failed, Please Try again Later...",
      500
    );
    return next(error);
  }
  if (existingUser) {
    return next(
      new HttpError("User with Email Already Exists, Login Instead...", 422)
    );
  }

  let hashedPassword;
  try {
    hashedPassword = await bcrypt.hash(password, 12);
  } catch (err) {
    return next(
      new HttpError("Could Not Create User, Please Try again...", 500)
    );
  }
  let imageFilePath;
  imageFilePath = req.file.path;

  const imagePath = await uploadOnCloudinary(imageFilePath);

  const createdUser = new User({
    name,
    email,
    image: imagePath?.secure_url || "",
    password: hashedPassword,
    places: [],
  });
  try {
    await createdUser.save();
  } catch (err) {
    return next(
      new HttpError(
        "Could Not Sign Up Right Now, Please Try Again Later....",
        500
      )
    );
  }

  let token;
  try {
    token = jwt.sign(
      {
        userId: createdUser.id,
        email: createdUser.email,
      },
      process.env.JWT_SECRET_KEY,
      {
        expiresIn: "1h",
      }
    );
  } catch (err) {
    return next(
      new HttpError(
        "Could Not Sign Up Right Now, Please Try Again Later....",
        500
      )
    );
  }

  res
    .status(201)
    .json({ userId: createdUser.id, email: createdUser.email, token: token });
};

const login = async (req, res, next) => {
  const { email, password } = req.body;
  let identifiedUser;
  try {
    identifiedUser = await User.findOne({ email: email });
  } catch (err) {
    return next(
      new HttpError("Could Not Find the User, Please Signup Instead")
    );
  }

  if (!identifiedUser) {
    return next(
      new HttpError("Could Not Identify User, Credentials are Incorrect", 403)
    );
  }

  let isValidPassword = false;
  try {
    isValidPassword = await bcrypt.compare(password, identifiedUser.password);
  } catch (err) {
    return next(
      new HttpError("Could Not Login Right Now, Please Try again later", 500)
    );
  }
  if (!isValidPassword) {
    return next(new HttpError("Invalid Credentials, Could Not Login you", 403));
  }

  let token;
  try {
    token = jwt.sign(
      {
        userId: identifiedUser.id,
        email: identifiedUser.email,
      },
      process.env.JWT_SECRET_KEY,
      {
        expiresIn: "1h",
      }
    );
  } catch (err) {
    return next(
      new HttpError(
        "Could Not Login Right Now, Please Try Again Later....",
        500
      )
    );
  }

  res.json({
    userId: identifiedUser.id,
    email: identifiedUser.email,
    token: token,
  });
};

exports.getUsers = getUsers;
exports.signup = signup;
exports.login = login;
