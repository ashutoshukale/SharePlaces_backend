const jwt = require("jsonwebtoken");

const HttpError = require("../models/http-error");

const auth = (req, res, next) => {
  if (req.method === "OPTIONS") {
    next();
  }
  try {
    const token = req.headers.authorization.split(" ")[1]; //authorization:'Bearer TOKEN'
    if (!token) {
      throw new Error("Authentication Failed");
    }

    const decodedToken = jwt.verify(token, process.env.JWT_SECRET_KEY);

    req.userData = { userId: decodedToken.userId };

    next();
  } catch (err) {
    return next(new HttpError("Authentication Failed!!", 403));
  }
};
module.exports = auth;
