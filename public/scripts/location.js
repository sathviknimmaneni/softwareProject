function getLocation() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(showPosition, showError);
  } else {
    console.log("not supported");
  }
}

function showPosition(position) {
  var dist=calcCrow(position.coords.latitude,position.coords.longitude,17.568334, 78.435942).toFixed(1);
  if(dist > 10){
document.getElementById("startAuctionButton").disabled=true;
  }else{
document.getElementById("startAuctionButton").disabled=false;
  }

  //This function takes in latitude and longitude of two location and returns the distance between them as the crow flies (in km)
  function calcCrow(lat1, lon1, lat2, lon2)
  {
    var R = 6371; // km
    var dLat = toRad(lat2-lat1);
    var dLon = toRad(lon2-lon1);
    var lat1 = toRad(lat1);
    var lat2 = toRad(lat2);

    var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.sin(dLon/2) * Math.sin(dLon/2) * Math.cos(lat1) * Math.cos(lat2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    var d = R * c;
    return d;
  }

  // Converts numeric degrees to radians
  function toRad(Value)
  {
      return Value * Math.PI / 180;
  }
}

function showError(error) {
  switch(error.code) {
    case error.PERMISSION_DENIED:
      getLocation()
      break;
    case error.POSITION_UNAVAILABLE:
      console.log("Location information is unavailable.");
      break;
    case error.TIMEOUT:
      console.log("The request to get user location timed out.");
      break;
    case error.UNKNOWN_ERROR:
      console.log("An unknown error occurred.");
      break;
  }
}
