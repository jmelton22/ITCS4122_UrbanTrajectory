//Init Map
//*******************************************************************************************************************************************************
var lat = 41.141376;
var lng = -8.613999;
var zoom = 14;

// add an OpenStreetMap tile layer
var mbAttr = 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, ' +
    '<a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, ' +
    'Imagery © <a href="http://mapbox.com">Mapbox</a>',
    mbUrl = 'https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token=pk.eyJ1IjoicGxhbmVtYWQiLCJhIjoiemdYSVVLRSJ9.g3lbg_eN0kztmsfIPxa9MQ';


var grayscale = L.tileLayer(mbUrl, {
        id: 'mapbox.light',
        attribution: mbAttr
    }),
    streets = L.tileLayer(mbUrl, {
        id: 'mapbox.streets',
        attribution: mbAttr
    });


var map = L.map('map', {
    center: [lat, lng], // Porto
    zoom: zoom,
    layers: [streets],
    zoomControl: true,
    fullscreenControl: true,
    fullscreenControlOptions: { // optional
        title: "Show me the fullscreen!",
        titleCancel: "Exit fullscreen mode",
        position: 'bottomright'
    }
});

var baseLayers = {
    "Grayscale": grayscale, // Grayscale tile layer
    "Streets": streets, // Streets tile layer
};

layerControl = L.control.layers(baseLayers, null, {
    position: 'bottomleft'
}).addTo(map);

// Initialise the FeatureGroup to store editable layers
var drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);

var featureGroup = L.featureGroup();

var drawControl = new L.Control.Draw({
    position: 'bottomright',
	collapsed: false,
    draw: {
        // Available Shapes in Draw box. To disable anyone of them just convert true to false
        polyline: false,
        polygon: false,
        circle: false,
        rectangle: true,
        marker: false,
    }
});
map.addControl(drawControl); // To add anything to map, add it to "drawControl"

//*******************************************************************************************************************************************************
//*****************************************************************************************************************************************
// Index Road Network by Using R-Tree
//*****************************************************************************************************************************************
var rt = cw(function(data, cb) {
	var self = this;
	var request, _resp;
	importScripts("js/rtree.js");
	if(!self.rt) {
		self.rt = RTree();
		request = new XMLHttpRequest();
		request.open("GET", data);
		request.onreadystatechange = function() {
			if (request.readyState === 4 && request.status === 200) {
				_resp = JSON.parse(request.responseText);
				self.rt.geoJSON(_resp);
				cb(true);
			}
		};
		request.send();
	}else{
		return self.rt.bbox(data);
	}
});

rt.data(cw.makeUrl("js/trips.json"));
//*****************************************************************************************************************************************	
//*****************************************************************************************************************************************
// Drawing Shapes (polyline, polygon, circle, rectangle, marker) Event:
// Select from draw box and start drawing on map.
//*****************************************************************************************************************************************	

map.on('draw:created', function(e) {
	
	var type = e.layerType,
		layer = e.layer;
	
	if (type === 'rectangle') {
		console.log(layer.getLatLngs()); //Rectangle Corners points
		var bounds = layer.getBounds();
		rt.data([[bounds.getSouthWest().lng, bounds.getSouthWest().lat],
				[bounds.getNorthEast().lng, bounds.getNorthEast().lat]])
			.then(function(d){var result = d.map(function(a) { return a.properties; });
		console.log(result);		// Trip Info: avspeed, distance, duration, endtime, maxspeed, minspeed, starttime, streetnames, taxiid, tripid
		DrawRS(result);
		DrawScatter(result);
		// TODO: Add D3 visualization functions, ex: drawGraph(result)

		});
	}
	
	drawnItems.addLayer(layer);			//Add your Selection to Map

	// TODO: Add layers to map (heatmap, start/end points)

});
//*****************************************************************************************************************************************
// DrawRS Function:
// Input is a list of road segments ID and their color. Then the visualization can show the corresponding road segments with the color
// Test:      var input_data = [{road:53, color:"#f00"}, {road:248, color:"#0f0"}, {road:1281, color:"#00f"}];
//            DrawRS(input_data);
//*****************************************************************************************************************************************
function DrawRS(trips) {
	for (var j = 0; j < trips.length; j++) {  // Check Number of Segments and go through all segments
		var TPT = [];
		TPT = TArr[trips[j].tripid].split(',');  		 // Find each segment in TArr Dictionary. 
		var polyline = new L.Polyline([]).addTo(drawnItems);
        polyline.setStyle({
            color: 'red',                      // polyline color
			weight: 1,                         // polyline weight
			opacity: 0.5,                      // polyline opacity
			smoothFactor: 1.0  
        });
		for(var y = 0; y < TPT.length - 1; y = y+2){    // Parse latlng for each segment
			polyline.addLatLng([parseFloat(TPT[y+1]), parseFloat(TPT[y])]);
		}
	}		
}

function DrawScatter(trips) {
	// Initialize svg for plots on right side
	var margin = {left: 40, top: 50, right: 20, bottom: 20},
		width = $("#rightside").width() - margin.left - margin.right,
		height = $('#rightside').height() / 3 - margin.bottom - margin.top;

	var svg = d3.select("#rightside")
		.append('svg')
		.attr("width", (width + margin.left + margin.right))
		.attr("height", (height + margin.top + margin.bottom))
		.append('g')
		.attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

	let data = trips.map(t => {
		let end = new Date(t['endtime']);
		let start = new Date(t['starttime']);
		let diff = end - start;

		return {
			'duration': Math.floor((diff/1000)/60),
			'avspeed': t['avspeed']
		};
	});

	data.forEach((d, i) => {
		console.log(i);
		for(let key in d) {
			console.log(key, d[key]);
		}
	});

	const xScale = d3.scaleLinear()
		.domain([0, d3.max(data.map(d => d.duration)) + 4])
		.range([0, width]);

	// const maxSpeed = d3.max(trips.map(trip => trip['avspeed']));
	const yScale = d3.scaleLinear()
		.domain([0, d3.max(data.map(d => d.avspeed))]).nice()
		.range([height, 0]);

	const xAxis = d3.axisBottom(xScale);
	const yAxis = d3.axisLeft(yScale);

	// x axis path and ticks
	svg.append('g')
		.attr('class', 'axis')
		.attr('transform', 'translate(0, ' + height + ')')
		.call(xAxis);

	// y axis path + ticks
	svg.append('g')
		.attr('class', 'axis')
		.call(yAxis);

	// x axis path and ticks
	svg.append('g')
		.attr('class', 'axis')
		.attr('transform', 'translate(0, ' + height + ')')
		.call(xAxis);

	// y axis path + ticks
	svg.append('g')
		.attr('class', 'axis')
		.call(yAxis);

	// y axis label
	svg.append('text')
		.attr('class', 'label')
		.attr('transform', 'rotate(-90)')
		.attr('x', -(height / 2.5))
		.attr('y', -(margin.left / 1.5))
		.attr('font-size', 14)
		.attr('font-style', 'italic')
		.style('text-anchor', 'end')
		.text('Avg Speed');

	// Main title
	svg.append('text')
		.attr('x', width / 2)
		.attr('y', -margin.top / 2)
		.attr('dy', '.35em')
		.attr('font-size', 18)
		.attr('font-weight', 'bold')
		.attr('fill', 'black')
		.style('text-anchor', 'middle')
		.text('Average Speed vs. Duration');

	// Tooltip div
	let tooltip = d3.select('#rightside')
		.append('div')
		.attr('class', 'tooltip')
		.style('opacity', 1.0);

	// Tooltip mouseover handler
	let tipMouseover = d => {
		let html = 'test';

		tooltip.html(html)
			.style('left', (d3.event.pageX + 15) + 'px')
			.style('top', (d3.event.pageY - 28) + 'px')
			.transition()
			.duration(200)
			.style('opacity', 0.9)
	};

	let tipMouseout = d => {
		tooltip.transition()
			.duration(300)
			.style('opacity', 0)
	};

	svg.selectAll('.dot')
		.data(data)
		.enter().append('circle')
		.attr('class', 'dot')
		.attr('cx', d => xScale(d.duration))
		.attr('cy', d => yScale(d.avspeed))
		.attr('r', 4)
		.on('mouseover', tipMouseover)
		.on('mouseout', tipMouseout);
}