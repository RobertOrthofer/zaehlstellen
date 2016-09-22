

	var map;
	var viewpoint;
	var selectedOptions = {}; //global variable for selecting matching id, coordinate-field, epsg,...
													// selectedOptions are arrays with property names (might be nested)
													//(e.g.: ["properties", "zaehlstelle"])

	var selectionStatus = {       // save state of JSON drop-down menu, so they dont have to be checked via DOM-queries
		coords: false,
		date: false
	};

	var currentFiles = {}; // save filenames of dropped data


	//import Chart from './node_modules/chart.js/src/chart.js';

	//------------ Funktion initMap() für die Karte--------------------------------------------------------------------- -->
	function initMap() {
		map = new ol.Map({target: "map"});

		viewpoint = new ol.View({ center: ol.proj.fromLonLat([14.82719, 47.21595]), zoom: 9 });
		map.setView(viewpoint);

		//-------------------  Basemap  -------------------------------
		var background_grey = new ol.layer.Tile();
		background_grey.set('visible', true);
		background_grey.set('name', 'grau');
		map.addLayer(background_grey);

		// Topographic Layer
		var background_ortho = new ol.layer.Group();
		background_ortho.set('visible', false);
		background_ortho.set('name', 'ortho');
		var background_img = new ol.layer.Tile();
		var background_labels = new ol.layer.Tile();
		background_ortho.setLayers(new ol.Collection([background_img, background_labels]));
		map.addLayer(background_ortho);

		var xhr = new XMLHttpRequest();
		xhr.open('GET', 'http://www.basemap.at/wmts/1.0.0/WMTSCapabilities.xml');
		xhr.onload = function() {
			var caps = new ol.format.WMTSCapabilities().read(xhr.responseText);
			var options = ol.source.WMTS.optionsFromCapabilities(caps, {
				layer: 'bmapgrau',
				matrixSet: 'google3857',
				requestEncoding: 'REST',
				style: 'normal'
			});
			background_grey.setSource(new ol.source.WMTS(options));
			options = ol.source.WMTS.optionsFromCapabilities(caps, {
				layer: "bmaporthofoto30cm",
				matrixSet: 'google3857',
				requestEncoding: 'REST',
				style: 'normal'
			});
			background_img.setSource(new ol.source.WMTS(options));
			options = ol.source.WMTS.optionsFromCapabilities(caps, {
				layer: "bmapoverlay",
				matrixSet: 'google3857',
				requestEncoding: 'REST',
				style: 'normal'
			});
			background_labels.setSource(new ol.source.WMTS(options))
		};
		xhr.send();
	}


//---- Zählstellenpunkte für Karte --------------------------------------------------------------------------->
function add_zaehlstellen(coords_json)
{
	console.log("Apply Coordinates Button pressed")
	// save the current Selection to global variable selectedOptions, so they can only be changed with the apply button
	var idField = document.getElementById("coordIDSelect").value.split(","); // array, because it might be nested
	var coordsField = document.getElementById("coordSelect"). value.split(","); // array, because it might be nested
	selectedOptions.coordID = idField;
	selectedOptions.coordField = coordsField;

	ZaehlstellenPoints = new ol.layer.Vector({
		source: new ol.source.Vector({
			features: (new ol.format.GeoJSON()).readFeatures(coords_json, { featureProjection: 'EPSG:3857' })
			//url: coords_json,
			//format: new ol.format.GeoJSON()
		}),
		style: function(feature, resolution){
			var geom = feature.getGeometry().getType();
			var id = feature.get(idField[1]);
			return styles[geom];
		}
	});
	var styles = {   // initial style
		'Point': [new ol.style.Style({
			image: new ol.style.Circle({
				radius: 15,
				fill: new ol.style.Fill({color: 'black'})
			})
		})]
		,
	};
	map.addLayer(ZaehlstellenPoints);
	ZaehlstellenPoints.set('name', idField[idField.length-1]); // name layer after last item in idField-array
	if (typeof(zaehlstellen_data)!== "undefined"){
		updateStyle(0);
		if(typeof(selectedOptions.dateField) !== "undefined"){	updateInput(0, false, false); };
		document.getElementById("sliderDiv").style.display= 'inline-block';
	}

}


	//------- Change Style of Points according to Value of Zählstelle --------->
	function updateStyle(y){  // y = integer of current day
		//console.log(window.radiustest);
		//window.radiustest = 0;
		// calculate min and max values for current day (for radius)
		var max_thisDay = -Infinity;
		for (var k in zaehlstellen_data[y]) { // of for every zaehlstelle
			if (typeof zaehlstellen_data[y][k] == 'number') { // only numbers, one item is the date
				var amount = zaehlstellen_data[y][k];
				if (amount > max_thisDay) {max_thisDay = amount}; // maximum
			}
		}
		// write values into size-legend
		document.getElementById("size_image_max").innerHTML = max_thisDay; // biggest circle (d=70px) = maximum value
		var middle_value = Math.round(max_thisDay/4); // Circle with half diameter (35px) = 1/4 Area
		document.getElementById("size_image_mid").innerHTML = middle_value;
		var small_value = Math.round(max_thisDay*0.07854); // Circle with 1/7 diameter (10px)
		document.getElementById("size_image_min").innerHTML = small_value;

		ZaehlstellenPoints.setStyle(function(feature, resolution){
			var geom = feature.getGeometry().getType();  // geom = point
			var zaehlstelle = feature.get(selectedOptions.coordID[1]);  // electedOptions.coordID[1] = z.B. b0251
			var amount = zaehlstellen_data[y][zaehlstelle]; // amount = z.B. 1055
			//example: min_max_zaehlstelle["b02501"][1] = maximum of b02501 of all days

			var color_hue = 110 - Math.round((amount/min_max_zaehlstelle[zaehlstelle][1])*110) // 110 = green, 0 = red, between = yellow
			var feature_color = 'hsl('+ color_hue +', 99%, 99%)';
			var radius_size = Math.sqrt((amount/(2*Math.PI)))/Math.sqrt((max_thisDay/(2*Math.PI)))*35;

		//if (radius_size > window.radiustest) {window.radiustest = radius_size}; // maximum TEST



			var styles = {
				'Point': [new ol.style.Style({
				image: new ol.style.Circle({
				radius: radius_size,
				fill: new ol.style.Fill({color: 'hsl('+color_hue+', 100%, 50%)'}),
				stroke: new ol.style.Stroke({color: 'hsl('+color_hue+', 100%, 20%)', width: 3})
				})
				})]
				,
			};
			return styles[geom];
		});
	};


	//------- Drag and Drop -------------------->
	// Initiate the Dropzone
	function init_dropzone(){
		var dropZone1 = document.getElementById('drop_zone1');
		dropZone1.addEventListener('dragover', handleDragOver, false);
		dropZone1.addEventListener('drop', handleFileSelect1, false);

		var dropZone2 = document.getElementById('drop_zone2');
		dropZone2.addEventListener('dragover', handleDragOver, false);
		dropZone2.addEventListener('drop', handleFileSelect2, false);
	}

	//---------- Handle File Selection (Coordinates-JSON)------------------------------------------------------>
	function handleFileSelect1(evt) {
		evt.stopPropagation();
		evt.preventDefault();

		var files = evt.dataTransfer.files; // FileList object.

		if(typeof(currentFiles.Coords) !== "undefined"){
			var r = confirm("Override existing File?"); // ask User
			if(r == true){
				console.log("Override File");
				// now clear all old options from Coords- and Match-ID-Selection
				var select = document.getElementById("coordSelect");
				var select2 = document.getElementById("coordIDSelect");
				var length = select.options.length; // the 2 selects should have same options
				for (i = 0; i < length; i++) {
				  select.options[0] = null;
				  select2.options[0] = null;
				}
			}
			else{
				console.log("Do nothing");
				return;
			}
		}
		// files is a FileList of File objects. List some properties.
		var output = [];
		f = files[0];

		output.push('<li><strong>', escape(f.name), '</strong>  - ',
		f.size, ' bytes, last modified: ',
		f.lastModifiedDate ? f.lastModifiedDate.toLocaleDateString() : 'n/a','</li>');
		currentFiles.Coords = f.name;

		coords_json ={};
		var reader = new FileReader(); // to read the FileList object
		reader.onload = function(event){  // Reader ist asynchron, wenn reader mit operation fertig ist, soll das hier (JSON.parse) ausgeführt werden, sonst ist es noch null
			if (f.name.substr(f.name.length - 3) ==="csv"){ // check if filetiype is csv
				coords_json = csvToGeoJSON(reader.result);
			}
			else {
				coords_json = JSON.parse(reader.result);
			}
			document.getElementById("hideCoordSelection").style.visibility = "visible";
			document.getElementById("choseFieldDiv1").style.visibility = "visible";
			document.getElementById("renderCoordinatesButton").style.visibility = "visible";
			document.getElementById("hideSelectionHolder").style.visibility = "visible";

			askFields(coords_json.features[0], 1);  // only first feature is needed for property names
			document.getElementById("renderCoordinatesButton").addEventListener('click', function(){add_zaehlstellen(coords_json);}, false);
			//console.log('added Event Listener to apply button');
			//add_zaehlstellen(coords_json);
		};
		reader.readAsText(f,"UTF-8");

		document.getElementById('list_coords').innerHTML = '<ul style="margin: 0px;">' + output.join('') + '</ul>';
	}

	// convert .csv to geoJSON
	function csvToGeoJSON(csv){ //csv = reader.result
			var lines=csv.split(/\r?\n/);
			//var result = [];
			var headers=lines[0].split(",");

			var obj_array = []
			for(var i=1;i<lines.length;i++){
				var json_obj = {"type": "Feature"};
				var currentline=lines[i].split(",");
				//for(var j=0;j<headers.length;j++){
					json_obj["geometry"] = {
							"type" : "Point",
							"coordinates" : [currentline[1], currentline[2]]};
					json_obj["properties"] = {"zaehlstelle" : currentline[0]}; // not variable yet, in progress
					obj_array.push(json_obj);
			};

		var complete_geojson = {"type":"FeatureCollection",
								"features": obj_array // all objects of the csv
								}
	//	alert(complete_geojson);
		return complete_geojson; //return geoJSON
	}

// ------------- handle File drop of Data-JSON -------------------------------------------------------------->
	function handleFileSelect2(evt) {
		evt.stopPropagation();
		evt.preventDefault();

		var files = evt.dataTransfer.files; // FileList object.

		if(typeof(currentFiles.Data) !== "undefined"){
			var r = confirm("Override existing File?"); // ask User
			if(r == true){
				console.log("Override File");
				// now clear all old options from Data-Selection
				var select = document.getElementById("dateSelect");
				var length = select.options.length;
				for (i = 0; i < length; i++) {
				  select.options[0] = null;
				}
			}
			else{
				console.log("Do nothing");
				return;
			}
		}

		// files is a FileList of File objects. List some properties.
		var output = [];
		f = files[0];
		output.push('<li><strong>', escape(f.name), '</strong>  - ',
		f.size, ' bytes, last modified: ',
		f.lastModifiedDate ? f.lastModifiedDate.toLocaleDateString() : 'n/a','</li>');

		currentFiles.Data = f.name;

		var reader = new FileReader(); // to read the FileList object
		reader.onload = function(event){  // Reader ist asynchron, wenn reader mit operation fertig ist, soll das hier (JSON.parse) ausgeführt werden, sonst ist es noch null
			if (f.name.substr(f.name.length - 3) ==="csv"){ // check if filetiype is csv
				zaehlstellen_data = csvToJSON(reader.result);
			}
			else{
				zaehlstellen_data = JSON.parse(reader.result);  // global, better method?
			}

			document.getElementById("renderDataButton").style.visibility = "visible";
			document.getElementById("hideDataSelection").style.visibility = "visible";
			document.getElementById("choseFieldDiv2").style.visibility = "visible";
			document.getElementById("hideSelectionHolder").style.visibility = "visible";

			askFields(zaehlstellen_data[0], 2);  // only first feature is needed for property names
			document.getElementById("renderDataButton").addEventListener('click', function(){applyDate();}, false);
		};
		reader.readAsText(f);

		// global variable for selection
		selectedWeekdays = [0,1,2,3,4,5,6]; // select all weekdays before timeslider gets initialized
		oldSelectedStreetNames = [] // Array for street names, if same amount of points are selected, but different streetnames -> redraw chart completely
		document.getElementById('list').innerHTML = '<ul>' + output.join('') + '</ul>';
	}

	// convert data (.csv) to JSON
	function csvToJSON(csv){ //csv = reader.result
			var lines=csv.split(/\r?\n/);
			//var result = [];
			var headers=lines[0].split(",");

			//calculate headers.length and lines.length one time only for performance reasons
			var linesLength = lines.length;  // = number of zaehlstellen
			var headerLength = headers.length;  // = number of dates the data is provided

			var splittedLinesArray = [];  // split all the lines in advance, so they dont have to be split for every single value
			for(var k=1; k<linesLength; k++){
				var thisLine = lines[k].split(",");
				splittedLinesArray.push(thisLine);
			}

			var obj_array = [];
			var dateName = headers[0]

			for(var i=1;i<headerLength;i++){ // for every date...
				var json_obj = {};
				json_obj[dateName] = headers[i];  // headers is dates (top row of csv)
				for(var j=1; j<linesLength; j++){ // for every zaehlstelle...
					var currentZaehlstelle = splittedLinesArray[j-1][0]; // takes name of current zaehlstelle (very left column of csv)
					var currentValue = splittedLinesArray[j-1][i];
					json_obj[currentZaehlstelle] = parseInt(currentValue);
				}
				obj_array.push(json_obj);
			};
		return obj_array; //return data-JSON
	}



	function applyDate(){
		console.log("Apply-Date Button pressed");
		var dateField = document.getElementById("dateSelect").value.split(",");
		selectedOptions.dateField = dateField;

		makeDateObjects(zaehlstellen_data);
		init_timeslider(zaehlstellen_data);
		find_dataRange(zaehlstellen_data);

		if(typeof(selectedOptions.coordID) !== "undefined"){  // if coordID was selected and applied...
			map.getLayers().forEach(function(layer) {
				//if(typeof(layer.get('name')) !== "undefined"){
					if (layer.get('name') == selectedOptions.coordID[selectedOptions.coordID.length-1]) {  // layer is named after last item of coordID-array
					  updateStyle(0);
					  if(typeof(selectedOptions.coordID) !== "undefined"){	updateInput(0, false, false); };
					  document.getElementById("sliderDiv").style.display= 'inline-block';
					}
				//};
			});
		}
	}


	//---------- Drag Over ------------------->
	function handleDragOver(evt) {
		evt.stopPropagation();
		evt.preventDefault();
		evt.dataTransfer.dropEffect = 'copy'; // Explicitly show this is a copy.
	}
	//---------- Fill Timeslider with min and max Values ---------->
	function init_timeslider(data){
		console.log("init_timeslider");
		var minDatum = data[0][selectedOptions.dateField];
		var maxDatum = data[data.length-1][selectedOptions.dateField];
		document.getElementById("time_slider").setAttribute("max", data.length-1);
	}
	//---------- Button one step left/right ---------->
	function changeDateOneStep(step, loop){    // takes -1 or 1 from left/right-Buttons and updates the current Date, loop is true when auto-play is on, so it starts at 0 when end of data is reached
		var x = document.getElementById("time_slider").value;
		var thisDate = parseInt(x) + parseInt(step); // thisDate = integer of Timestep (e.g. 0 = first Date in Data)
		var goLeft = (step == -1) ? true : false;
		updateInput(thisDate, goLeft, loop);
	}
	//---------- Find min and max Data Values for Visualization ---------->
	function find_dataRange(data){
		console.log("find_dataRange");
		min_max_zaehlstelle ={};
		for (k = 1; k < Object.keys(data[0]).length; k++){  // name of zaehlstelle
			var name_zaehlstelle = Object.keys(zaehlstellen_data[0])[k];
			var min_max = [Infinity, -Infinity];

			for (i = 1; i < data.length; i++){  // also via keys? // value of zaehlstelle at certain date
				var amount = data[i][name_zaehlstelle];

				if (amount < min_max[0]) {min_max[0] = amount};
				if (amount > min_max[1]) {min_max[1] = amount};

			}
			min_max_zaehlstelle[name_zaehlstelle] = min_max; // assign min/max-Values to Object
		}
	}
	//--------- Parse Date-Strings into JS Date Objects -------------------->
	function makeDateObjects(data){
		console.log("makeDateObjects");
		for (i = 0; i < data.length; i++){
			var datestring = data[i][selectedOptions.dateField];
			var thisYear   = parseInt(datestring.substring(0,4));
			var thisMonth  = parseInt(datestring.substring(5,7));
			var thisDay   = parseInt(datestring.substring(8,10));
			var thisDateComplete = new Date(thisYear, thisMonth-1, thisDay);  // JS-Date Month begins at 0
			zaehlstellen_data[i][selectedOptions.dateField] = thisDateComplete;
		}
	}
//-------- Function for Checkboxes of Weekday-Selection (visuals) ------------>
function change_state(obj){
		selectedWeekdays = [];
		var weekdays = document.querySelectorAll('input[name=weekday]:checked');
		for (i = 0; i < weekdays.length; i++){
			selectedWeekdays.push(parseInt(weekdays[i].value));
		}
  }

	//  Update of Shown Value   -->
	function updateInput(thisDate, goLeft, loop) { // go left: true if going left. loop: true to start at 0 when max x time is reached
		// Create Arrays for Printing the Date
		var d_names = new Array("Sunday", "Monday", "Tuesday",
		"Wednesday", "Thursday", "Friday", "Saturday");

		var m_names = new Array("January", "February", "March",
		"April", "May", "June", "July", "August", "September",
		"October", "November", "December");

		//check if day of week is selected
		var foundNextWeekday = false;
		// repeat until selected weekday is found
		while (foundNextWeekday == false){
			thisDate = parseInt(thisDate);

			if(thisDate >= zaehlstellen_data.length-1){ // if maximum time is reached
				if (loop === true){
					thisDate = 0;
				}
				else{
					break;
				}
			};

			if (thisDate < 0){
				break;
			};

			var d = zaehlstellen_data[thisDate].datum;
			if (typeof(selectedWeekdays) != "undefined" && selectedWeekdays.indexOf(d.getDay()) >= 0){
				var curr_day = d.getDay();
				var curr_date = d.getDate();
				var sup = "";
				if (curr_date == 1 || curr_date == 21 || curr_date ==31)
				   {
				   sup = "st";
				   }
				else if (curr_date == 2 || curr_date == 22)
				   {
				   sup = "nd";
				   }
				else if (curr_date == 3 || curr_date == 23)
				   {
				   sup = "rd";
				   }
				else
				   {
				   sup = "th";
				   }
				var curr_month = d.getMonth();
				var curr_year = d.getFullYear();
				var shownDate = d_names[curr_day] + ", "+ m_names[curr_month] + " " + curr_date + "<SUP>" + sup + "</SUP>" + ", "  + curr_year;

				document.getElementById('currentDate').innerHTML = shownDate;

				updateStyle(thisDate);
				foundNextWeekday = true;
				document.getElementById("time_slider").value = thisDate; // Update of Timeslider
				if (typeof selectedFeatures !== "undefined"  && selectedFeatures.length > 0){createPolyChart(selectedFeatures)}
			}
			else if (selectedWeekdays.length == 0){
				alert("No Weekday Selected");
				break;
				foundNextWeekday = true;
				} // Break while when end of Data is reached
			else{
				thisDate = (goLeft == true) ? thisDate-1 : thisDate+1;
			}
		}
	}



//--------------------- Select By Polygon (copypasta) ---------------->
	var draw; // global so we can remove it later
	function SelectByPolygon(){
		// remove point selection
		if (typeof(select) !== "undefined") {
			select.getFeatures().item(0).setStyle(null)
			map.removeInteraction(select);
		};
		if (typeof(draw) !== "undefined") {
			map.removeInteraction(draw);
			drawingSource.clear();
		};
		if(typeof(drawingSource) !== "undefined"){
			drawingSource.clear();
		}
		drawingSource = new ol.source.Vector(); // global, unsauber?

		var drawingLayer = new ol.layer.Vector({
				source: drawingSource,
				style: new ol.style.Style({
				fill: new ol.style.Fill({
					  color: 'rgba(191, 214, 239, 0.4)'
					}),
					stroke: new ol.style.Stroke({
					  color: '#4A74AA',
					  width: 2
					}),
					image: new ol.style.Circle({
					  radius: 70,
					  fill: new ol.style.Fill({
						color: '#000000'
					  })
					})
				})
			});
		map.addLayer(drawingLayer);

		draw = new ol.interaction.Draw({
			  source: drawingSource,
			  type: 'Polygon'
			  //geometryFunction: geometryFunction,  //Function that is called when a geometry's coordinates are updated.
			});

		draw.on('drawstart', function(e) {
			drawingSource.clear();
			});

		draw.on('drawend', function(e){
				var polygonGeometry = e.feature.getGeometry();
				selectedFeatures = []; // Array for Point Features  // global because used when timeslider changes, not safe?
				oldSelectedStreetNames = [] // Array for street names, if same amount of points are selected, but different streetnames -> redraw chart completely

				for (i = 0; i < ZaehlstellenPoints.getSource().getFeatures().length; i++){ // for every Point (zaehlstelle)...
					var pointExtent = ZaehlstellenPoints.getSource().getFeatures()[i].getGeometry().getExtent();
					if (polygonGeometry.intersectsExtent(pointExtent)==true){ //returns true when Polygon intersects with Extent of Point (= Point itself)
						selectedFeatures.push(ZaehlstellenPoints.getSource().getFeatures()[i]);
					}
				}
				createPolyChart(selectedFeatures);
			});
	map.addInteraction(draw);
	}

//------------------------ Create Charts ---------------------------->
function createPolyChart(selectedFeatures){
	// Get Sreet Names
	var selectedStreetNames = [];
		for (i = 0; i < selectedFeatures.length; i++){
			selectedStreetNames.push(selectedFeatures[i].getProperties().zaehlstelle);  // get all streetnames (= zaehlstellen) from selection
		};


	// Get corresponding Data
	var time = document.getElementById("time_slider").value;
	var currentData = zaehlstellen_data[time]; // zaehlstellen-Data from all the Features at current time
	var selectedData = [];
		for (i = 0; i < selectedStreetNames.length; i++){
			selectedData.push(currentData[selectedStreetNames[i]]); // Data from selected Streets
		};

	// get maximum of selected features at all times (to set maximum of scale)
	var dataMax = 0;
	for (var i = 0; i < selectedStreetNames.length; i++) {
		if (min_max_zaehlstelle[selectedStreetNames[i]][1] > dataMax){dataMax = min_max_zaehlstelle[selectedStreetNames[i]][1];}; // if maximum value of selected zaehlstelle is bigger than current maximum value, replace it
	}
	dataMax = Math.ceil(dataMax/1000)*1000; // round up to next 1000



	// Make Multi-Feature Chart
	// Destroy existing Chart if number of selected Elements differs
	var chartDestroyed = false;

	// JS Magic for comparing scalar arrays
	//var SameStreetNames = selectedStreetNames.length!==oldSelectedStreetNames.length && selectedStreetNames.every(function(v,i) { return v === oldSelectedStreetNames[i]});
	var SameStreetNames = selectedStreetNames.equals(oldSelectedStreetNames);
	if (myChart.id !== "myChart" && (selectedFeatures.length !== myChart.data.datasets[0].data.length || !SameStreetNames )){
		myChart.destroy();
		chartDestroyed = true;
		}
	// overwrite the old selected Street Names, so if e.g. 1 point is selected both times, but its a different point, the chart is getting destroyed and remade
	oldSelectedStreetNames = selectedStreetNames.slice() // global, not referenced

	// hide snapshot button if no point is selected (chart is invisible anyways, because no redraw)
	if (selectedFeatures.length === 0){document.getElementById("snapshot_button").style.display="none";};

	// if Chart already exists, update it with new values and labels (e.g. only time changed)
	if (myChart.id !== "myChart" && chartDestroyed == false && selectedFeatures.length !== 0){
		//alert ("update");
		myChart.labels = selectedStreetNames;
		myChart.data.datasets[0].data = selectedData;
		myChart.update();
		myChart.render();
		myChart.resize();
	}

	else if (selectedFeatures.length !== 0){	 // If Chart didnt exist before...
		var ctx = document.getElementById("myChart");
			myChart = new Chart(ctx, {  // global, unsauber?
			type: 'bar',
			data: {
				labels: selectedStreetNames,
				datasets: [{
					label: 'Value',
					data: selectedData,
					backgroundColor: 'rgba(164, 196, 232, 0.7)',
					borderColor: 'rgba(	74, 116, 170, 0.7)',
					borderWidth: 1
				}]
			},
			options: {
				//animation : false,
				scales: {
					yAxes: [{
						ticks: {
							min: 0,
							max: dataMax,
							beginAtZero:true
						}
					}]
				},
				legend: {
					display: false
				}
			}
		});
	// make snapshot_button visible again
	document.getElementById("snapshot_button").style.display="block";
	}
	// make div visible if something is in it
	if (selectedFeatures.length > 0 || (typeof(snapshotArray) != "undefined" && snapshotArray.length >0)){
	//	document.getElementById("canvas_div").style.visibility = 'visible';
			document.getElementById("canvas_div").style.display = "block";
	}
	else{
		document.getElementById("canvas_div").style.display = "none";
	}
};

// ---------------------------------------- Snapshot function --------------------------------------------------------------
function snapshot(){
	// create empty snapshot array
	if (typeof(snapshotArray) == "undefined"){
			snapshotArray = [];
	};

	// create array with parameters of this snapshot
	var thisSnapshot = [];
	thisSnapshot[0] = parseInt(document.getElementById("time_slider").value); // Save Current date
	thisSnapshot[1] = selectedFeatures; // Save Current Selected Features
	snapshotArray.push(thisSnapshot);

	// append row to the HTML table
	var tbl = document.getElementById('snapshot_table') // table reference
    var row = tbl.insertRow(tbl.rows.length)      // append table row
    var eyeButtonCell = row.insertCell(0);

	var buttonText = "Snapshot " + tbl.rows.length;
	// create button with value of index of array (of this snapshot)
	var btn = document.createElement('input');
	btn.type = "button";
	btn.className = "other_button";
	btn.setAttribute("id", "showSnapshot");
	btn.value = buttonText;
	btn.setAttribute('snapshotIndex', tbl.rows.length);
	btn.onclick = function () {showSnapshot(this.getAttribute('snapshotIndex')-1);};

	eyeButtonCell.appendChild(btn);

	document.getElementById("snapshot_div").style.visibility='visible';

};

function showSnapshot(snapshotIndex){
	updateInput(snapshotArray[snapshotIndex][0], false, false);
	createPolyChart(snapshotArray[snapshotIndex][1]);
};

function deleteSnapshots(){
	var tbl = document.getElementById('snapshot_table'), // table reference
        lastRow = tbl.rows.length - 1,             // set the last row index
        i;
    // delete rows with index greater then 0
    for (i = lastRow; i >= 0; i--) {
        tbl.deleteRow(i);
    }
snapshotArray = [];
document.getElementById("snapshot_div").style.visibility = "hidden";
}

function noBackground(){
	map.getLayers().forEach(function(layer) {
		if (layer.get('name') == 'grau') {
		  layer.setVisible(false);
		}
		if (layer.get('name') == 'ortho') {
		  layer.setVisible(false);
		}
	});
}

function viewBasemap(){
	map.getLayers().forEach(function(layer) {
		if (layer.get('name') == 'grau') {
		  layer.setVisible(true);
		}
		if (layer.get('name') == 'ortho') {
		  layer.setVisible(false);
		}
	});
}

function viewAerial(){
	map.getLayers().forEach(function(layer) {
		if (layer.get('name') == 'grau') {
		  layer.setVisible(false);
		}
		if (layer.get('name') == 'ortho') {
		  layer.setVisible(true);
		}
	});
}


/////////  TEST changing array protoype to compare (arr1.equals(arr2)) arrays, not part of a function?
Array.prototype.equals = function (array, strict) {
    if (!array)
        return false;

    if (arguments.length == 1)
        strict = true;

    if (this.length != array.length)
        return false;

    for (var i = 0; i < this.length; i++) {
        if (this[i] instanceof Array && array[i] instanceof Array) {
            if (!this[i].equals(array[i], strict))
                return false;
        }
        else if (strict && this[i] != array[i]) {
            return false;
        }
        else if (!strict) {
            return this.sort().equals(array.sort(), true);
        }
    }
    return true;
}


function SelectSinglePoint(){
	// remove polygon selection
	if (typeof(draw) !== "undefined") {
		map.removeInteraction(draw);
		drawingSource.clear();
	};
	select = new ol.interaction.Select(); // Interaktion
	map.addInteraction(select); // Interaktion der Karte hinzufügen

	// single point selection
	var oldStyle;
	select.on('select', function(e) {
		if(typeof(zaehlstellen_data) !== "undefined"){
			var features = select.getFeatures(); // Feature Array
			var feature = features.item(0); //  first element
			var y = parseInt(document.getElementById("time_slider").value);

			var selected = e.selected;
			var deselected = e.deselected;

			if (selected.length) {
				selected.forEach(function(feature){
					var zaehlstelle = feature.get('zaehlstelle');  // zaehlstelle = z.B. b0251
					var amount = zaehlstellen_data[y][zaehlstelle]; // amount = z.B. 1055
					//example: min_max_zaehlstelle["b02501"][1] = maximum of b02501

					//style when selected
					var color_hue = 110 - Math.round((amount/min_max_zaehlstelle[zaehlstelle][1])*110) // 110 = green, 0 = red, between = yellow
					var feature_color = 'hsl('+ color_hue +', 99%, 99%)';

					var radius_size = (Math.round((amount/min_max_zaehlstelle[zaehlstelle][1]))+1)*10;
					oldStyle = feature.getStyle();
					var style_modify = new ol.style.Style({
							image: new ol.style.Circle({
								radius: radius_size,
								fill: new ol.style.Fill({color: 'hsl('+color_hue+', 100%, 80%)'}),
								stroke: new ol.style.Stroke({color: 'hsl('+color_hue+', 100%, 50%)', width: 7})
						})
					});
					feature.setStyle(style_modify);
					});
				}
			if (deselected.length){
				deselected.forEach(function(feature){
					feature.setStyle(null);
				});
			}

			selectedFeatures = selected.length ? [feature] : []	;
			createPolyChart(selectedFeatures);
		}
	});

	// changing cursor when over Feature
	// map.on("pointermove", function (evt) {
        // var hit = this.forEachFeatureAtPixel(evt.pixel,
			// function(feature, layer) {
			// return true;
				// });
			// if (hit) {
				// this.getTarget().style.cursor = 'pointer';
				// } else {
			// this.getTarget().style.cursor = '';
			// }
	// });
};

// functon for changing Time every second
function autoPlay(){
		if (typeof(interval_handle) == "undefined"){
				interval_handle = setInterval(function(){
						changeDateOneStep(1, true); // loop = true
					}, 1000);
			document.getElementById("auto_play_button").innerHTML = "Stop &#10074;&#10074;";
		}
		else{
			clearInterval(interval_handle); // clear Interval
			delete window.interval_handle; // destroy Interval Handle
			document.getElementById("auto_play_button").innerHTML = "Auto-Play &#9658";
		}
};

//----------Populating Selections for ID and Coordinates after Drag&Drop--------------------------------------------------
function askFields(first_feature, option){
	// @option:
	//		1: Coordinates
	// 		2: Data
	option == 1 ? showCoordsSelection() : showDateSelection();

	switch(option)
	{
		case 1:  // = coordinates-json
		{
			var coordIDSelection = document.getElementById('coordIDSelect');
			var coordSelection = document.getElementById('coordSelect');
			index = 0;
			Object.keys(first_feature).forEach(function(prop) {  // prop = property name
				//console.log(prop);
				if(typeof(first_feature[prop]) === "object"){ // if Object is nested, go into next level
					//console.log(prop + " is an object");
					Object.keys(first_feature[prop]).forEach(function(prop_nested){
						//console.log(prop + ": " + prop_nested);
						var opt = document.createElement("option");
						opt.value= [prop, prop_nested];
						opt.innerHTML = prop + ": " + prop_nested; // whatever property it has

						coordIDSelection.appendChild(opt);
						var opt2 = opt.cloneNode(true); // clone Options for other Selection
						coordSelection.appendChild(opt2);
						index++;
					});
				}
				else{ // if current Object is not nested...
					var opt = document.createElement("option");
					opt.value= [prop];
					opt.innerHTML = prop; // whatever property it has

					coordIDSelection.appendChild(opt);
					var opt2 = opt.cloneNode(true); // clone Options for other Selection
					coordSelection.appendChild(opt2);

					index++;
				}
			});

			// Behavior of sliding Div and show/hide-Buttons depending on option
				document.getElementById("hideCoordSelection").style.display="inline-block";
				document.getElementById("hideCoordSelection").innerHTML = "△";
//				document.getElementById('choseFieldDiv1').style.transform = "translateY(90px)";
		}  // end of case 1 (=coordinates-Json)
		break;

		case 2: //(= Data-json)
		{
			var dateSelection = document.getElementById('dateSelect');
			index = 0;
			Object.keys(first_feature).forEach(function(prop) {  // prop = property name
				//console.log(prop);
				if(typeof(first_feature[prop]) === "object"){ // if Object is nested, go into next level
					//console.log(prop + " is an object");
					Object.keys(first_feature[prop]).forEach(function(prop_nested){
						//console.log(prop + ": " + prop_nested);
						var opt = document.createElement("option");
						opt.value= [prop, prop_nested];
						opt.innerHTML = prop + ": " + prop_nested; // whatever property it has
						dateSelection.appendChild(opt);
						index++;
					});
				}
				else{ // if current Object is not nested...
					var opt = document.createElement("option");
					opt.value= [prop];
					opt.innerHTML = prop; // whatever property it has
					dateSelection.appendChild(opt);
					index++;
				}
			}); // end of forEach Object.keys

			document.getElementById("hideDataSelection").style.display="inline-block";
			document.getElementById("hideDataSelection").innerHTML = "△";
		}	// end of case 2 (=Data-json)
		break;
	}// end of switch
}

//------------- show/hide current Selection-DIV (ID = id of clicked button)------------------------------------------------------
function showCoordsSelection(){
	// if other selection is open, close it
	if (selectionStatus.date == true){ showDateSelection(); };

	console.log("hide/show Coordinate Selection ");

	// calculating direction of div (up or down)
	if (selectionStatus.coords == false){
		document.getElementById("hideCoordSelection").innerHTML = "△";
		document.getElementById("hideCoordSelection").style.backgroundColor ="#4A74AA";
		document.getElementById('choseFieldDiv1').style.transform = "translateY(102px)";
		document.getElementById("menuBelowSelection").style.transform = "translateY(-60px)";
		selectionStatus.coords = true;
	}
	else {
		document.getElementById("hideCoordSelection").innerHTML = "▽";
		document.getElementById("hideCoordSelection").style.backgroundColor ="#A4C4E8";
		document.getElementById('choseFieldDiv1').style.transform = "translateY(-45px)";
		document.getElementById("menuBelowSelection").style.transform = "translateY(-210px)";
		selectionStatus.coords = false;
	}
}



function showDateSelection(){
	// if other selection is open, close it
	if (selectionStatus.coords == true){ showCoordsSelection(); };

	console.log("hide/show Data Selection ");

	// calculating direction of div (up or down)
	if (selectionStatus.date == false){
		document.getElementById("hideDataSelection").innerHTML = "△";
		document.getElementById("hideDataSelection").style.backgroundColor ="#4A74AA";
		document.getElementById('choseFieldDiv2').style.transform = "translateY(23px)";
		document.getElementById("menuBelowSelection").style.transform = "translateY(-140px)";
		selectionStatus.date = true;
	}
	else {
		document.getElementById("hideDataSelection").innerHTML = "▽";
		document.getElementById("hideDataSelection").style.backgroundColor ="#A4C4E8";
		document.getElementById('choseFieldDiv2').style.transform = "translateY(-45px)";
		document.getElementById("menuBelowSelection").style.transform = "translateY(-205px)";
		selectionStatus.date = false;
	}
}



/*
	// if other selection is open, close it
	if (selectionStatus.coords == true){ showDateSelection(); };

	console.log("hide/show Selection: " + ID);
	var otherID ="";
	if (ID ==="hideCoordSelection") {otherID ="hideDataSelection"}
	else {otherID = "hideCoordSelection"}

	//var dropZoneHeight = document.getElementById("drop_zone_holder").offsetHeight + document.getElementById("showCoordsSelectionHolder");

	// if selection-Div is hidden, show it, and hide the other div
	if(document.getElementById(ID).innerHTML == "▽"){
		document.getElementById(ID).innerHTML = "△";
		document.getElementById('choseFieldDiv1').style.transform = "translateY(100px)";
		document.getElementById("menuBelowSelection").style.transform = "translateY(0px)";
	}

	// if selection-Div is shown, hide it
	else{
		document.getElementById(ID).innerHTML = "▽";
		document.getElementById('choseFieldDiv1').style.transform = "translateY(0px)";
		document.getElementById("menuBelowSelection").style.transform = "translateY(-100px)";
	}
}
*/
