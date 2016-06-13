
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
		reader.onload = function(event){  // Reader ist asynchron, wenn reader mit operation fertig ist, soll das hier (JSON.parse) ausgeführt werden, sonst ist es noch 
			null				
			zaehlstellen_data = JSON.parse(reader.result);  // global, unsauber?
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
		var y = parseInt(x) + parseInt(step);
		document.getElementById("time_slider").value = y;
		updateInput(y);
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
		updateInput(0); // initiate timeslider to first day of data 
		document.getElementById("time_slider").value = 0;
	}
	
	//---- Update des Timeslider  ----------------->
	// Set max of Timeslider -->
	
	function changeRange(dataRange) {
		document.getElementById("time_slider").setAttribute("max", dataRange);
	}
	//  Update of Shown Value   -->
	function updateInput(val) {
		var currentDate = zaehlstellen_data[val].datum;
		document.getElementById('currentDate').innerHTML=currentDate; 
		updateStyle(val);
		if (typeof selectedFeatures !== "undefined"  && selectedFeatures.length > 0){createPolyChart(selectedFeatures)}
	}
	
	
	
//--------------------- Select By Polygon (copypasta) ---------------->
	var draw; // global so we can remove it later
	
	function SelectByPolygon(){
		var drawingSource = new ol.source.Vector();

		var drawingLayer = new ol.layer.Vector({
				source: drawingSource,
				style: new ol.style.Style({
				fill: new ol.style.Fill({
					  color: 'rgba(150, 255, 150, 0.2)'
					}),
					stroke: new ol.style.Stroke({
					  color: '#006600',
					  width: 2
					}),
					image: new ol.style.Circle({
					  radius: 70,
					  fill: new ol.style.Fill({
						color: '#ffcc33'
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
			//alert(selectedStreetNames[i]);
		};
	
	// Get corresponding Data
	var time = document.getElementById("time_slider").value;
	var currentData = zaehlstellen_data[time]; // zaehlstellen-Data from all the Features at current time
	var selectedData = [];
		for (i = 0; i < selectedStreetNames.length; i++){
			selectedData.push(currentData[selectedStreetNames[i]]); // Data from selected Streets
			//alert(selectedData[i]);
		};
	

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
					backgroundColor: 'rgba(75, 192, 192, 0.2)',
					borderColor: 'rgba(75, 192, 192, 1)',
					borderWidth: 1
				}]
			},
			options: {
				//animation : false,
				scales: {
					yAxes: [{
						ticks: {
							beginAtZero:true
						}
					}]
				}
			}
		});
	}
	
};
	
	
	
	
	
	
	
	
	
