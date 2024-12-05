const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const { validationResult } = require("express-validator");
const mongoose = require("mongoose");

const getCoordinates = require("../util/location");
const Place = require("../models/place");
const User = require("../models/user");
const HttpError = require("../models/http-error");

const getPlaceById = async (req, res, next) => {
  const placeId = req.params.pid;
  let place;
  try {
    place = await Place.findById(placeId);
  } catch (err) {
    const error = new HttpError(
      "Something Went Wrong, Could Not Find the Place",
      404
    );
    return next(error);
  }

  if (!place) {
    // next(error) // when we are using asynchronous code
    // throw error // when we are using synchronous code
    const error = new HttpError(
      "Could not find the place for provided id",
      404
    );
    return next(error);
  }

  res.json({ place: place.toObject({ getters: true }) });
};

const getPlacesByUserId = async (req, res, next) => {
  const userId = req.params.uid;
  // let places;
  let userWithPlaces;
  try {
    userWithPlaces = await User.findById(userId).populate("places");
  } catch (err) {
    const error = new HttpError(
      "Fetching Places Failed, Please try again....",
      500
    );
    return next(error);
  }
  if (!userWithPlaces.places) {
    return next(
      new HttpError("Could not find the place for provided user id", 404)
    );
  }

  res.json({
    places: userWithPlaces.places.map((place) =>
      place.toObject({ getters: true })
    ),
  });
};

const createPlace = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(
      new HttpError("Invalid Inputs Passed! Please check your data", 422)
    );
  }
  const { title, description, address } = req.body;
  let location;
  try {
    location = await getCoordinates(address);
  } catch (error) {
    return next(error);
  }

  const createdPlace = new Place({
    title,
    description,
    address,
    location,
    image: req.file.path,
    creator: req.userData.userId,
  });

  let user;

  try {
    user = await User.findById(req.userData.userId);
  } catch (err) {
    return next(new HttpError("Creating Place Failed, Please try again", 500));
  }

  if (!user) {
    return next(new HttpError("Could Not Find User for Provided Id", 404));
  }

  try {
    const sess = await mongoose.startSession();
    sess.startTransaction();
    await createdPlace.save({ session: sess });
    user.places.push(createdPlace);
    await user.save({ session: sess });
    await sess.commitTransaction();
  } catch (err) {
    const error = new HttpError(
      "Could Not Create the Place (Saving failed...)",
      500
    );
    return next(error);
  }

  res.status(201).json({ place: createdPlace });
};

const updatePlaceById = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(
      new HttpError("Invalid Inputs Passed! Please check your data", 422)
    );
  }
  const { title, description } = req.body;
  const placeId = req.params.pid;

  let place;
  try {
    place = await Place.findById(placeId);
  } catch (err) {
    const error = new HttpError(
      "Something Went Wrong, Could Not Update the Place!",
      500
    );
    return next(error);
  }

  if (place.creator.toString() !== req.userData.userId) {
    const error = new HttpError("You are Not Allowed to Edit this Place", 401);
    return next(error);
  }

  place.title = title;
  place.description = description;

  try {
    await place.save();
  } catch (err) {
    const error = new HttpError(
      "Something Went Wrong, Could Not save the updated Place",
      500
    );
    return next(error);
  }
  res.status(200).json({ place: place.toObject({ getters: true }) });
};

const deletePlaceById = async (req, res, next) => {
  const placeId = req.params.pid;
  let place;
  try {
    place = await Place.findById(placeId).populate("creator");
  } catch (err) {
    const error = new HttpError(
      "Something Went Wrong, Could Not Delete the Place",
      500
    );
    return next(error);
  }
  if (!place) {
    return next(new HttpError("Could Not Find Place for this id", 404));
  }

  if (place.creator.id !== req.userData.userId) {
    const error = new HttpError(
      "You are Not Allowed to Delete this Place",
      401
    );
    return next(error);
  }

  const imagePath = place.image;

  try {
    // await Place.deleteOne({ _id: placeId });
    const session = await mongoose.startSession();
    session.startTransaction();
    await Place.deleteOne({ _id: placeId }).session(session);
    place.creator.places.pull(place);
    await place.creator.save({ session: session });
    await session.commitTransaction();
  } catch (err) {
    const error = new HttpError(
      "Something Went Wrong, Could Not Delete the Place",
      500
    );
    return next(error);
  }
  fs.unlink(imagePath, (err) => {
    console.log(err);
  });
  res.status(200).json({ message: "Deleted Place" });
};

exports.getPlaceById = getPlaceById;
exports.getPlacesByUserId = getPlacesByUserId;
exports.createPlace = createPlace;
exports.updatePlaceById = updatePlaceById;
exports.deletePlaceById = deletePlaceById;
