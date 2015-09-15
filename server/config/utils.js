//API search functions

var apiKeys = require('../../apiKeys.js');
var request = require("request");
var yelp = require("yelp").createClient(apiKeys.yelpKeys());

module.exports.yelpSearch = function (searchTerm, callback){
  var results = yelp.search(searchTerm, function(err, data){
    if(err){
      callback({error: 'no geography that matches user inquiry found',
                error_code: 50});
    }else{
      callback(data);
    }
  });
};

module.exports.foursquareSearch = function (searchTerm, callback) {
  //this is the query string to be passed into foursquare's server
  var queryString = 
    'https://api.foursquare.com/v2/venues/explore?' +
    'client_id=' + apiKeys.foursquareKeys().client_ID + 
    '&client_secret=' + apiKeys.foursquareKeys().client_secret + 
    '&v=20130815&' +
    'near=' + searchTerm.location +
    '&query=' + searchTerm.term;
  request(queryString, function (error, response, body) {
    if (error) {
      throw error;
    }
    var parsedBody = JSON.parse(body);
    console.log(parsedBody);
    if (parsedBody.meta.code === 400) {
      if (parsedBody.meta.errorType === 'failed_geocode') {
        console.log('no geography that matches user inquiry found');
        callback({error: 'no geography that matches user inquiry found',
                  error_code: 50})
      }
    } else if (parsedBody.meta.code === 500) {
      console.log('foursquare server error');
    } else {
      bodyDir = parsedBody.response.groups[0]
      callback(bodyDir);
    }


  })
}

var findCoord = function (location, callback) {
  var queryString = 
    'https://maps.googleapis.com/maps/api/geocode/json?' + 
    'address=' + location +
    '&key='+ apiKeys.googleKeys().mapKey;
  request(queryString, function (error, response, body) {
    if (error) {
      throw error;
    }
    var parsedBody = JSON.parse(body);
    // console.log(parsedBody);
    callback(parsedBody);
  })
}

module.exports.googleSearch = function (searchTerm, callback) {
  findCoord(searchTerm.location, function(res) {
    if (res.status === 'ZERO_RESULTS') {
      console.log('no geography that matches user inquiry found');
      callback({error: 'no geography that matches user inquiry found',
                error_code: 50})
    } else {
      var location = res.results[0].geometry.location;
      var radius = Math.min((res.results[0].geometry.viewport.northeast.lat -
        res.results[0].geometry.viewport.southwest.lat) * 110000, 50000);
      console.log(radius);
      var queryString = 
        'https://maps.googleapis.com/maps/api/place/nearbysearch/json?' +
        'key=' + apiKeys.googleKeys().mapKey +
        '&location=' + location.lat + ',' + location.lng +
        '&keyword=' + searchTerm.term +
        '&radius=' + radius;
      request(queryString, function (error, response, body) {
        var parsedBody = JSON.parse(body);
        // console.log(parsedBody.results);
      })
    }
   
  })

  // var queryString = '';
  // request(queryString, function (error, response, body) {
  //   if (error) {
  //     throw error;
  //   }
  //   var parsedBody = JSON.parse(body);
  //   console.log(parsedBody);
  //   //insert forloop for each restaurant int he response.
  //   //do second API query to get result details
  // })
}

module.exports.matchRestaurants = function (yelpArray, foursquareArray) {
  var matchedRestaurants = [];

  function removeCommonWords (string) {
    var ignoreWords = ["restaurant", "cuisine"];
    var cleanedString = string;
    
    // for each word in ignore list, remove  any instances of that from the string
    ignoreWords.forEach( function(word){
      var regex = new RegExp( word, 'gi');
      cleanedString = cleanedString.replace(regex, "");
    });
    
    // removes duplicate spaces
    return cleanedString.replace( /\s+/, " ").trim();
  };

  function extractAddressNumber (string) {
    return string !== undefined ? string.match(/\d*\b/)[0] : null;
  };
  
  for (var restaurantsq = 0; restaurantsq < foursquareArray.length; restaurantsq++) {
    for (var restauranty = 0; restauranty < yelpArray.length; restauranty++){
      // if (extractAddressNumber(yelpArray[restauranty].location.address[0]) === extractAddressNumber(foursquareArray[restaurantsq].venue.location.address)) {
      //   console.log(removeCommonWords(foursquareArray[restaurantsq].venue.name).length, removeCommonWords(yelpArray[restauranty].name).length);
      // };
      if (removeCommonWords(foursquareArray[restaurantsq].venue.name) === removeCommonWords(yelpArray[restauranty].name) &&
          extractAddressNumber(foursquareArray[restaurantsq].venue.location.address) === extractAddressNumber(yelpArray[restauranty].location.address[0])) {
  
        var rest = new Restaurant(
          foursquareArray[restaurantsq].venue.name,
          // changed below to pull from yelp's location.display_address property instead of the location.address[0]
          // yelpArray[restauranty].location.address[0],
          yelpArray[restauranty].location.display_address,
          foursquareArray[restaurantsq].venue.url,
          foursquareArray[restaurantsq].venue.location.lat,
          foursquareArray[restaurantsq].venue.location.lng,
          {
            rating: yelpArray[restauranty].rating,
            ratingUrl: yelpArray[restauranty].rating_img_url,
            url: yelpArray[restauranty].url,
            reviewCount: yelpArray[restauranty].review_count
          },
          {
            rating: foursquareArray[restaurantsq].venue.rating,
            ratingColor: foursquareArray[restaurantsq].venue.ratingColor,
            url: createFoursquareURL(foursquareArray[restaurantsq].venue.id, foursquareArray[restaurantsq].venue.name),
            reviewCount: foursquareArray[restaurantsq].venue.ratingSignals
          },
          // yelpArray[restauranty].display_phone
          yelpArray[restauranty].display_phone,
          yelpArray[restauranty].image_url
          );
        matchedRestaurants.push(rest);
      }
    }
  }
  return matchedRestaurants;
}

var createFoursquareURL = function (venueID, venueName) {
  var url = 'https://foursquare.com/v/';
  for (var index = 0; index < venueName.length; index++) {
    if (venueName[index] === ' ') {
      url += '-';
    } else {
      url += venueName[index]
    }
  };
  url += '/' + venueID + '?ref=' + apiKeys.foursquareKeys().client_ID;
  return url;
}

var Restaurant = function (name, address, url, lat, long, yelpData, foursquareData, phoneNumber, imageUrl) {
  this.name = name;
  this.address = address;
  this.url = url;
  this.location = {
    latitute: lat,
    longitude: long
  };
  this.yelpData = yelpData;
  this.yelpData.rating = this.yelpData.rating || 0;
  this.yelpData.reviewCount = this.yelpData.reviewCount || 0;
  // {
  //   rating: 4,
  //   ratingUrl: 'https://www.yelp.com/image',
  //   url: 'https://www.yelp.com',
  //   reviewCount: 123
  // }

  this.foursquareData = foursquareData;
  this.foursquareData.rating = (this.foursquareData.rating / 2) || 0;
  this.foursquareData.reviewCount = this.foursquareData.reviewCount || 0;
  // {
  //   rating: 9.8,
  //   url: 'https://www.foursquare.com',
  //   reviewCount: 23
  // },

  this.totalReviews = this.yelpData.reviewCount + this.foursquareData.reviewCount;

  // this.compositeScore = (( this.yelpData.rating * 2 * this.yelpData.reviewCount +
  //                   this.foursquareData.rating * this.foursquareData.reviewCount ) / 
  //                   ( this.totalReviews )).toFixed(1);
  
  this.compositeScore = ((( this.yelpData.rating * this.yelpData.reviewCount) +
                    ((this.foursquareData.rating) * this.foursquareData.reviewCount )) / 
                    ( this.totalReviews )).toFixed(1);

  this.phoneNumber = phoneNumber;
  this.imageUrl = imageUrl;
}