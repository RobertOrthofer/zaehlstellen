
//------------ Funktion initMap() für die Karte--------------------------------------------------------------------- -->
	var map;
	var viewpoint;

	function initMap() {	
		map = new ol.Map({target: "map"});
		
		//-------------------  Basemap  -------------------------------
		var background = new ol.layer.Tile();
		var xhr = new XMLHttpRequest();
		xhr.open('GET', 'http://www.basemap.at/wmts/1.0.0/WMTSCapabilities.xml');
		xhr.onload = function() {
			var caps = new ol.format.WMTSCapabilities().read(xhr.responseText);
			var hiDPI = ol.has.DEVICE_PIXEL_RATIO >= 1.5;
			var options = ol.source.WMTS.optionsFromCapabilities(caps, {
				layer: hiDPI ? 'bmaphidpi' : 'geolandbasemap',
				matrixSet: 'google3857',
				requestEncoding: 'REST',
				style: 'normal'
			});
			options.tilePixelRatio = hiDPI ? 2 : 1;
			background.setSource(new ol.source.WMTS(options));
		};
		xhr.send();
		
		map.addLayer(background);
		
		viewpoint = new ol.View({ center: ol.proj.fromLonLat([14.82719, 47.21595]), zoom: 9 });	
		map.setView(viewpoint);	
		
		//vectorLayer = new ol.layer.Vector({
		//	source: new ol.source.Vector()
	//});
	add_zaehlstellen(); // adds the Points of Zählstellen			
	}


//---- Zählstellenpunkte für Karte --------------------------------------------------------------------------->
function add_zaehlstellen()	
{		
	ZaehlstellenPoints = new ol.layer.Vector({
		source: new ol.source.Vector({
			url: "http://robertorthofer.github.io/zaehlstellen/test_coords.json",
			format: new ol.format.GeoJSON()
		}),
		style: function(feature, resolution){ 
			var geom = feature.getGeometry().getType();
			var zaehlstelle = feature.values_.zaehlstelle; 
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
	}
	//------- Change Style of Points according to Value of Zählstelle --------->
	function updateStyle(y){  // y = integer of current day
		
		ZaehlstellenPoints.setStyle(function(feature, resolution){
		var geom = feature.getGeometry().getType();  // geom = point
		var zaehlstelle = feature.values_.zaehlstelle;  // zaehlstelle = z.B. b0251
		
		var amount = zaehlstellen_data[y][zaehlstelle]; // amount = z.B. 1055
		//example: min_max_zaehlstelle["b02501"][1] = maximum of b02501
		
		var color_hue = 110 - Math.round((amount/min_max_zaehlstelle[zaehlstelle][1])*110) // 110 = green, 0 = red, between = yellow
		var feature_color = 'hsl('+ color_hue +', 99%, 99%)';
		
		var radius_size = (Math.round((amount/min_max_zaehlstelle[zaehlstelle][1]))+1)*10;  
		
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
		var dropZone = document.getElementById('drop_zone');
		dropZone.addEventListener('dragover', handleDragOver, false);
		dropZone.addEventListener('drop', handleFileSelect, false);
	}
	
	//---------- Get File Reference ---------->
	function handleFileSelect(evt) {
		evt.stopPropagation();
		evt.preventDefault();
		
		var files = evt.dataTransfer.files; // FileList object.
		
		// files is a FileList of File objects. List some properties.
		var output = [];
		//for (var i = 0, f; f = files[i]; i++) {
		f = files[0];
		output.push('<li><strong>', escape(f.name), '</strong>  - ',
		f.size, ' bytes, last modified: ',
		f.lastModifiedDate ? f.lastModifiedDate.toLocaleDateString() : 'n/a','</li>');
		
		var reader = new FileReader(); // to read the FileList object
		reader.onload = function(event){  // Reader ist asynchron, wenn reader mit operation fertig ist, soll das hier (JSON.parse) ausgeführt werden, sonst ist es noch null				
			zaehlstellen_data = JSON.parse(reader.result);  // global, unsauber?
			makeDateObjects(zaehlstellen_data);	
			selectedWeekdays = [0,1,2,3,4,5,6]; // select all weekdays before timeslider gets initialized
			init_timeslider(zaehlstellen_data);
			find_dataRange(zaehlstellen_data);
		};
		reader.readAsText(f);	
		document.getElementById('list').innerHTML = '<ul>' + output.join('') + '</ul>';	
	}
	//---------- Drag Over ------------------->
	function handleDragOver(evt) {
		evt.stopPropagation();
		evt.preventDefault();
		evt.dataTransfer.dropEffect = 'copy'; // Explicitly show this is a copy.
	}
	//---------- Fill Timeslider with min and max Values ---------->
	function init_timeslider(data){
		var minDatum = data[0].datum;
		var maxDatum = data[data.length-1].datum;
		document.getElementById("sliderDiv").style.display= 'block';		
		changeRange(data.length-1);
	}
	//---------- Button one step left/right ---------->
	function changeDateOneStep(step){    // takes -1 or 1 from left/right-Buttons and updates the current Date
		var x = document.getElementById("time_slider").value;
		var thisDate = parseInt(x) + parseInt(step); // thisDate = integer of Timestep (e.g. 0 = first Date in Data)
		var goLeft = (step == -1) ? true : false;
		updateInput(thisDate, goLeft);
	}
	//---------- Find min and max Data Values for Visualization ---------->
	function find_dataRange(data){	
		min_max_zaehlstelle ={};
		//k = 0; // first zaehlstelle
		for (k = 1; k < Object.keys(data[0]).length; k++){  // name of zaehlstelle 
			var name_zaehlstelle = Object.keys(zaehlstellen_data[0])[k];
			var min_max = [Infinity, -Infinity];
			
			//min_max_zaehlstelle[name_zaehlstelle]["min"] = Infinity;
			//min_max_zaehlstelle[name_zaehlstelle]["max"] = -Infinity;
			for (i = 1; i < data.length; i++){  // also via keys? // value of zaehlstelle at certain date
				var amount = data[i][name_zaehlstelle];
				
				if (amount < min_max[0]) {min_max[0] = amount}; 
				if (amount > min_max[1]) {min_max[1] = amount};
				
			}
			min_max_zaehlstelle[name_zaehlstelle] = min_max; // assign min/max-Values to Object
		}	
		updateInput(0, false); // initiate timeslider to first day of data 
		//document.getElementById("time_slider").value = 0;
	}
	//--------- Parse Date-Strings into JS Date Objects -------------------->
	function makeDateObjects(data){
		for (i = 0; i < data.length; i++){
			var datestring = data[i].datum	
			var thisYear   = parseInt(datestring.substring(0,4));
			var thisMonth  = parseInt(datestring.substring(5,7));
			var thisDay   = parseInt(datestring.substring(8,10));
			var thisDateComplete = new Date(thisYear, thisMonth-1, thisDay);  // JS-Date Month begins at 0
			zaehlstellen_data[i].datum = thisDateComplete;
			//zaehlstellen_data[i].selected_weekday = true; // Create Property Selected Weekday, always True when newData ()
		}		
	}
//-------- Function for Checkboxes of Weekday-Selection (visuals) ------------>
function change_state(obj){
        if (obj.checked){
            //if checkbox is being checked, add a "checked" class
            obj.parentNode.classList.add("checked");
        }
        else{
            //else remove it
            obj.parentNode.classList.remove("checked");
        }
		// update weekday-selection with new selected weekdays
		selectedWeekdays = [];
		for (i = 0; i < document.getElementsByClassName("input-check checked").length; i++){
			selectedWeekdays.push(parseInt(document.getElementsByClassName("input-check checked")[i].childNodes[0].value));
		}
    }

	//---- Update des Timeslider  ----------------->
	// Set max of Timeslider -->
	
	function changeRange(dataRange) {
		document.getElementById("time_slider").setAttribute("max", dataRange);
	}
	
	//  Update of Shown Value   -->
	function updateInput(thisDate, goLeft) {
		//var currentDate = zaehlstellen_data[thisDate].datum;
		//document.getElementById('currentDate').innerHTML=currentDate; 
		// Create Arrays for Printing the Date
		var d_names = new Array("Sunday", "Monday", "Tuesday",
		"Wednesday", "Thursday", "Friday", "Saturday");

		var m_names = new Array("January", "February", "March", 
		"April", "May", "June", "July", "August", "September", 
		"October", "November", "December");

		//var d = zaehlstellen_data[thisDate].datum;
		//check if day of week is selected
		var foundNextWeekday = false;
		// repeat until selected weekday is found
		while (foundNextWeekday == false){
			thisDate = parseInt(thisDate);
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
			}
			else if (selectedWeekdays.length == 0){ 
				alert("No Weekday Selected");
				break;
				foundNextWeekday = true;
				} // Break while when end of Data is reached
			else{
				//alert(thisDate)
				thisDate = (goLeft == true) ? thisDate-1 : thisDate+1;
			}
		}
		if (typeof selectedFeatures !== "undefined"  && selectedFeatures.length > 0){createPolyChart(selectedFeatures)}
		
		document.getElementById("time_slider").value = thisDate; // Update of Timeslider
	}
	
	
	
//--------------------- Select By Polygon (copypasta) ---------------->
	var draw; // global so we can remove it later
	
	function SelectByPolygon(){
		var drawingSource = new ol.source.Vector();

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
				
				
				for (i = 0; i < ZaehlstellenPoints.getSource().getFeatures().length; i++){ // for every Point (zaehlstelle)...
					var pointExtent = ZaehlstellenPoints.getSource().getFeatures()[i].getGeometry().getExtent();
					if (polygonGeometry.intersectsExtent(pointExtent)==true){ //returns true when Polygon intersects with Extent of Point (= Point itself)
						selectedFeatures.push(ZaehlstellenPoints.getSource().getFeatures()[i]);
					}   
				}

				// var polygonExtent = e.feature.getGeometry().getExtent();  
				// ZaehlstellenPoints.getSource().forEachFeatureIntersectingExtent(polygonExtent, function(feature) {
					// selectedFeatures.push(feature);  // Array with all selected Features	
				// }); 
				
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
	//var keys = Object.keys(min_max_zaehlstelle);
	//alert (keys);
	for (var i = 0; i < selectedStreetNames.length; i++) {
		if (min_max_zaehlstelle[selectedStreetNames[i]][1] > dataMax){dataMax = min_max_zaehlstelle[selectedStreetNames[i]][1];}; // if maximum value of selected zaehlstelle is bigger than current maximum value, replace it
	}
	dataMax = Math.ceil(dataMax/1000)*1000; // round up to next 1000
	
	

	// Make Multi-Feature Chart
	// Destroy existing Chart if number of selected Elements differs
	var chartDestroyed = false;
	if (myChart.id !== "myChart" && selectedFeatures.length != myChart.data.datasets[0].data.length){
		//alert("destroy Chart")
		myChart.destroy();
		chartDestroyed = true;
		}
	
	
	// if Chart already exists, update it with new values and labels (e.g. only time changed)
	if (myChart.id !== "myChart" && chartDestroyed == false && selectedFeatures.length > 0){
		//alert ("update");
		myChart.labels = selectedStreetNames;
		myChart.data.datasets[0].data = selectedData;
		myChart.update();
		myChart.render();
		myChart.resize();
	}
	
	else if (selectedFeatures.length > 0){	 // If Chart didnt exist before...
		//alert ("first chart");
		var ctx = document.getElementById("myChart");
			myChart = new Chart(ctx, {  // global, unsauber?
			type: 'bar',
			data: {
				labels: selectedStreetNames,
				datasets: [{
					label: 'Traffic Amount',
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
				}
			}
		});
	}
	// make div visible if something is in it
	if (selectedFeatures.length > 0 || (typeof(snapshotArray) != "undefined" && snapshotArray.length >0)){
		document.getElementById("canvas_div").style.visibility = 'visible';
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
	//var snapshotNameCell = row.insertCell(1);
	//var deleteRowButtonCell = row.insertCell(2);
	
	var buttonText = "Snapshot " + tbl.rows.length;
	// create button with value of index of array (of this snapshot)
	var btn = document.createElement('input');
	btn.type = "button";
	btn.className = "other_button";
	btn.setAttribute("id", "showSnapshot");
	btn.value = buttonText;
	btn.setAttribute('snapshotIndex', tbl.rows.length);
	btn.onclick = function () {showSnapshot(this.getAttribute('snapshotIndex')-1);};
 
	//td.appendChild(btn);
	
	eyeButtonCell.appendChild(btn); 
	//snapshotNameCell.innerHTML = "Snapshot " + tbl.rows.length;
	//deleteRowButtonCell.innerHTML = "Delete Snapshot";
	
	document.getElementById("snapshot_div").style.visibility='visible';
	
};

function showSnapshot(snapshotIndex){
	//console.log ("show Snapshot Number " + snapshotIndex);	
	updateInput(snapshotArray[snapshotIndex][0], false);
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
document.getElementById("snapshot_div").style.visibility = "hidden";
}


	
	
	
	
	
	
	
	
