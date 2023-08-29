async function fetchWeather(lat, long) {
  const weatherAPI = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${long}&appid=${process.env.OWM_API}&units=imperial`;
  const weatherData = await fetch(weatherAPI)
    .then(res => res.json())
    .catch(err => err.name);
  return weatherData;
}

function locationFormat({ data: { components: w }, data }) {
  const fullAddress = data.formatted.split(',', 1).toString();

  const formatString = `${w.suburb || fullAddress}, ${w.state_code ||
    w.country_code.toUpperCase()}`;

  return {
    suburb: w.suburb,
    city: w.city,
    stateCode: w.state_code,
    countryCode: w.country_code.toUpperCase(),
    fullAddress,
    formatString,
  };
}
// 1 case: auto locate user

async function getRegion(clientIP) {
  const { city, region_code, latitude: lat, longitude: long } = await fetch(
    `https://ipapi.co/${clientIP}/json/`
  ).then(res => {
      if (res.ok) {
          return res.json();
      } else {
        // fallback default
        return {
          region_code: 'VIC',
          city: 'Melbourne',
          latitude: -37.81,
          longitude: 144.9644,
        };
      }
    })
    .catch(err => console.log(err));  
  const formatString = `${city}, ${region_code}`;
  const weatherData = await fetchWeather(lat, long);
  return { weatherData, locationData: { formatString } };
}

//  2 case: browser locate

async function getGeocode(lat, long) {
  const geocodeAPI = `https://api.opencagedata.com/geocode/v1/json?q=${lat},${long}&key=${
    process.env.GEOCODE_API
  }&no_annotations=1&limit=1`;
  try {
    const {
      results: [data],
    } = await fetch(geocodeAPI)
      .then(res => res.json())
      .catch(err => err);
    return locationFormat({ data });
  } catch (error) {
    return error.toString();
  }
}

//  3 case: user query

async function getSearchData(query) {
  const forwardApi = `https://api.opencagedata.com/geocode/v1/json?q=${query}&key=${
    process.env.GEOCODE_API
  }&no_annotations=1&limit=1`;
  const {
    results: [data],
  } = await fetch(forwardApi).then(res => res.json());
  const weatherData = await fetchWeather(data.geometry.lat, data.geometry.lng);

  return {
    weatherData,
    locationData: locationFormat({ data }),
  };
}

module.exports = async (req, res) => {
  const { lat, long } = req.query;
  const { region } = req.query;
  const { search } = req.query;
  const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  if (search) {
    try {
      const searchData = await getSearchData(search);
      return res.status(200).send(searchData);
    } catch (error) {
      return res.status(500).send(error.name.toString());
    }
  }
  if (region === 'true') {
    try {
      const regionData = await getRegion(clientIP);
      return res.status(200).send(regionData);
    } catch (error) {
      // console.log(error);
      return res.status(500).send(error.toString());
    }
  }

  if (!lat || !long) {
    return res
      .status(500)
      .send('Error: Missing Latitude (and/or) Longitude attributes');
  }
  try {
    const weatherData = await fetchWeather(lat, long);
    const locationData = await getGeocode(lat, long);
    const data = {
      weatherData,
      locationData,
    };
    return res.status(200).send(data);
  } catch (err) {
    return res.status(500).send(err.toString());
  }
};