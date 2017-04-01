// Global variables
var username;
var connected = false;
var socket = io();
var map;
var draw;
var select;
var selFeatures = [];

$(function() {

  // Do map-related stuff
  setUpMap();


  // Elements
  $loginPage = $('#login');
  $usernameInput = $('#usernameInput');
  $mapPage = $('#map');
  $notifications = $('.notifications');
  $drawControl = $('#drawControl');
  $multi = $('.multiple');    // Tools for multi-selections
  $single = $('.single');     // Tools for single selections
  $double = $('.double');     // Tools for double selections
  $all = $('.all');           // Tools for all selections
  $delete = $('#delete');
  $buffer = $('#buffer');
  $union = $('#union');
  $intersection = $('#intersection');
  $fullExtent = $('#full-extent');

  // Focus on input by defult
  $usernameInput.focus();

  $usernameInput.keydown(function(e) {
    if (e.which === 13) {
      setUsername();
    }
  });

  $drawControl.click(function() {
    if ($drawControl.hasClass('positive')) {
      map.addInteraction(draw);
      $drawControl.removeClass('positive');
      $drawControl.addClass('negative');
      $drawControl.text('Stop Drawing');
      // Remove select interaction
      map.removeInteraction(select);
    } else {
      map.removeInteraction(draw);
      $drawControl.removeClass('negative');
      $drawControl.addClass('positive');
      $drawControl.text('Start Drawing');
      // Re-instantiate select functionality
      map.addInteraction(select);
    }
  });

  $delete.click(deleteHandler);
  $("body").keydown(function(e) {
    // Delete or Backspace
    if ( (e.keyCode == 46 || e.keyCode == 8) && $delete.is(':visible')) {
      deleteHandler();
      e.preventDefault();
      return false;
    }

  });

  $buffer.click(function() {
    var amount = prompt('Buffer by (metres): ');

    if (amount) {
      socket.emit('buffer feature', selFeatures[0].getGeometry().getCoordinates(), amount, selFeatures[0].id);
      select.getFeatures().clear(); // Un-select
      updateSelected();
      //socket.emit('buffer feature', (new ol.format.GeoJSON()).writeFeatureObject(selFeature), amount, selFeature.id);
    }
  });

  $union.click(function() {
    var geom1 = selFeatures[0].getGeometry().getCoordinates();
    var geom2 = selFeatures[1].getGeometry().getCoordinates();

    socket.emit('union features', geom1, geom2, selFeatures[0].id, selFeatures[1].id);
  });


  $intersection.click(function() {
    socket.emit('intersect features', selFeatures[0].getGeometry().getCoordinates(), selFeatures[1].getGeometry().getCoordinates());

  });

  $fullExtent.click(function() {
    map.getView().fit(drawingSource.getExtent(), map.getSize());
  });






  // SOCKET EVENTS
  // When this user has logged in
  socket.on('login', function(data) {
    setUserCount(data.numUsers);
  });

  // When new user joins
  socket.on('user joined', function(data) {
    setUserCount(data.numUsers);
    addNotification('<a>' + data.username + '</a> joined');
  });

  // When a user leaves
  socket.on('user left', function(data) {
    setUserCount(data.numUsers);
    addNotification('<a>' + data.username + '</a> left');
  });

  // When a user clicks on map
  socket.on('user clicked', function(data) {
    var feature = new ol.Feature({
      username: data.username,
      geometry: new ol.geom.Point(data.coordinates)
    });
    feature.username = data.username;

    // Add feature, then remove in 1 seconds
    clickSource.addFeature(feature);
    window.setTimeout(function() {
      clickSource.removeFeature(feature);
    }, 1000);
  });


  // When a user has finished drawing
  socket.on('feature drawn', function(data) {
    // console.log(data.geom);
    var feature = new ol.Feature({
      geometry: new ol.geom.Polygon(data.geom),
    });
    feature.id = data.id;
    drawingSource.addFeature(feature);
    addNotification('<a>' + data.username + '</a> drew a feature');
  });

  // When a feature has been deleted
  socket.on('features deleted', function(data) {
    // Remove features
    removeFeatures(data.ids);
    // Display message for one or more features
    var msgToDisplay = (data.ids.length == 1) ? '<a>' + data.username + '</a> deleted a feature' :  '<a>' + data.username + '</a> deleted ' + data.ids.length + ' features';
    addNotification(msgToDisplay);
  });


  // When a feature has been buffered
  socket.on('feature buffered', function(data) {
    var f = new ol.Feature({
      geometry: new ol.geom.Polygon(data.feature.geometry.coordinates),
    });
    f.id = data.id;

    removeFeatureByID(data.id);
    drawingSource.addFeature(f);
    addNotification('<a>' + formatUsername(data.username) + '</a> buffered a feature');
  });

  // When two features have been unioned
  socket.on('features unioned', function(data) {
    // If MultiPolygon was returned, input features were not contiguous
    if (data.feature.geometry.type == 'MultiPolygon')
      return addNotification('<span style="color:red"><a>' + formatUsername(data.username) + '</a> tried to union two features that were not contiguous</span>');

    var f = new ol.Feature({
      geometry: new ol.geom.Polygon(data.feature.geometry.coordinates)
    });

    f.id = data.id;

    // Remove original features
    removeFeatures(data.toRemove);

    // Add unioned feature
    drawingSource.addFeature(f);
    addNotification('<a>' + formatUsername(data.username) + '</a> unioned two features');
  });


  // When the intersection of two features has been calculated
  socket.on('features intersected', function(data) {
    if (typeof data.feature == 'undefined')
      return addNotification('<span style="color:red"><a>' + data.username + '</a> tried to calculate an intersection, however the polygons do not intersect</span>');

    var f = new ol.Feature({
      geometry: new ol.geom.Polygon(data.feature.geometry.coordinates)
    });
    f.id = data.id;

    // Add feature representing intersection
    drawingSource.addFeature(f);
    addNotification('<a>' + formatUsername(data.username) + '</a> calculated the intersection between two features');
  });

});




function setUsername() {
  username = $usernameInput.val().trim();

  // If the username is valid
  if (username) {
    $loginPage.fadeOut();
    $mapPage.show();
    $loginPage.off('click');
    map.updateSize();

    // Tell the server your username
    socket.emit('add user', username);
  }
}

function formatUsername(user) {
  // If the event was triggered by this user, change output to "You"
  if (user == username) {
    return "You";
  }
  return user;
}

function setUserCount(number) {
  $(userCount).text(number);
}

function addNotification(msg) {
  $notifications.append('<div class="event">' +
  '<div class="content">' +
    '<div class="summary">' +
       msg +
    '</div>' +
  '</div>');
  // Remove notification after elapsed time
  window.setTimeout(function() {
    $('.notifications div').first().remove();
  }, 5000);
}

function deleteHandler() {
  // Remove feature
  removeSelected();
  socket.emit('features deleted', getSelFeatureIDs());

  select.getFeatures().clear(); // Un-select
  updateSelected();             // Hide menu
}
