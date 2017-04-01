var clickSource = new ol.source.Vector({});
var drawingSource = new ol.source.Vector({});

var drawingLayer = new ol.layer.Vector({
  style: new ol.style.Style({
    fill: new ol.style.Fill({
      color: 'rgba(0, 128, 0, 0.7)'
    })
  }),
  source: drawingSource
});
var clickLayer = new ol.layer.Vector({
  style: pointStyleFunction,
  source: clickSource
});

function pointStyleFunction(feature, resolution) {
  return new ol.style.Style({
    image: new ol.style.Icon({
      anchor: [0.5, 46],
      anchorXUnits: 'fraction',
      anchorYUnits: 'pixels',
      opacity: 0.75,
      src: 'http://maps.google.com/mapfiles/ms/icons/red.png'
    }),
    text: createTextStyle(feature, resolution)
  })
}

function createTextStyle(feature, resolution) {
  return new ol.style.Text({
    text: feature.username,
    scale: 1.3,
    fill: new ol.style.Fill({
      color: 'black'
    }),
    stroke: new ol.style.Stroke({
      color: '#ffffff',
      width: 3.5
    })
  });
}


/**
  * Set-up map
*/
function setUpMap() {
  map = new ol.Map({
    layers: [
      new ol.layer.Tile({
        source: new ol.source.OSM()
      }),
      drawingLayer, clickLayer
    ],
    controls: ol.control.defaults({
      attributionOptions: /** @type {olx.control.AttributionOptions} */ ({
        collapsible: false
      })
    }),
    target: 'map',
    view: new ol.View({
      center: [0, 0],
      zoom: 2
    })
  });


  // ************
  // Interactions
  // ************
  draw = new ol.interaction.Draw({
    source: drawingSource,
    type: 'Polygon'
  });
  select = new ol.interaction.Select({
    condition: ol.events.condition.click,
    toggleCondition: ol.events.condition.shiftKeyOnly
  });

  // ******
  // Events
  // ******
  // Drawing end
  draw.on('drawend', function(evt) {
    var geom = evt.feature.getGeometry().getCoordinates();
    var randomID = Math.random();
    evt.feature.id = randomID;
    socket.emit('feature drawn', geom, randomID);
  });
  // Selecting
  select.on('select', function(e) {
    // If a feature has been selected or deselected
    updateSelected();
  });
  // When user clicks
  map.on('click', function(evt) {
    socket.emit('user clicked', evt.coordinate);
  });


  // Add select as default interaction
  map.addInteraction(select);

}


/**
  * Remove feature by ID
*/
function removeFeatureByID(id) {
  var f = getFeatureByID(id);
  drawingSource.removeFeature(f);
}

/**
  * Get feature by ID
*/
function getFeatureByID(id) {
  var featureToLocate = null;
  drawingSource.getFeatures().forEach(function(f) {
    if (f.id == id) {
      featureToLocate = f;
    }
  });

  return featureToLocate;
}


/**
  * Update the selected features array
*/
function updateSelected() {
  selFeatures = [];
  select.getFeatures().forEach(function(f) {
    selFeatures.push(f);
  });

  if (selFeatures.length == 1) {
    $multi.hide(); $double.hide(); $single.show(); $all.show();
  }
  else if (selFeatures.length == 2) {
    $multi.hide(); $single.hide(); $double.show(); $all.show();
  }
  else if (selFeatures.length > 1) {
    $single.hide(); $double.hide(); $multi.show(); $all.show();
  }
  else {
    $single.hide(); $double.hide(); $multi.hide(); $all.hide();
  }

}

/**
  * Remove selected feature(s)
*/
function removeSelected() {
  select.getFeatures().forEach(function(f) {
    drawingSource.removeFeature(f);
  });
}

/**
  * Remove an array of features, using an array of IDs
*/
function removeFeatures(ids) {
  ids.forEach(function(id) {
    removeFeatureByID(id);
    // If currently selected, delete from select layer (for usability purposes)
    select.getFeatures().forEach(function(f) {
      if (f.id == id) {
        select.getFeatures().remove(f);
      }
    });

  });
  updateSelected(); // Update selected layer (i.e. if selected features have been deleted, hide any menus)
}

/**
  * Get the IDs of all selected features
*/
function getSelFeatureIDs() {
  var featureIDs = [];
  selFeatures.forEach(function(f) {
    featureIDs.push(f.id);
  });

  return featureIDs;
}
