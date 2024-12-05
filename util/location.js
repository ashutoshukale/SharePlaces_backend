const axios = require("axios");
const HttpError = require("../models/http-error");
async function getCoordinates(address) {
  const response = await axios.get(
    `https://geocode.maps.co/search?q=${address}&api_key=${process.env.API_KEY}`
  );

  const data = response.data;
  if (!data) {
    const error = new HttpError(
      "Could Not find the location for the specified address",
      422
    );
    throw error;
  }
  const coordinates = { lat: data[0].lat, lng: data[0].lon };

  return coordinates;
}

module.exports = getCoordinates;
