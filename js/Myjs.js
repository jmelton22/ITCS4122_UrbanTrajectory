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

		// TODO: Add D3 visualization functions, ex: drawGraph(result)
		ScatterSpeedDuration(result);
		ScatterDistanceDuration(result);
		ScatterSpeedDistance(result);

		//DrawWordcloud(result);
		DrawBarChart(result);
		// DrawChordPlot(result);
		});
	}
	
	drawnItems.addLayer(layer);			//Add your Selection to Map

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

function ScatterSpeedDuration(trips) {
	// Initialize svg for plot
	var margin = {left: 40, top: 50, right: 20, bottom: 30},
		width = $("#plot1").width() - margin.left - margin.right,
		height = $('#plot1').height() - margin.bottom - margin.top;

	var svg = d3.select("#plot1")
		.append('svg')
		.attr("width", (width + margin.left + margin.right))
		.attr("height", (height + margin.top + margin.bottom))
		.append('g')
		.attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

	// Generate x and y axis scales
	const xScale = d3.scaleLinear()
		.domain([0, d3.max(trips.map(t => t.duration / 60)) + 4])
		.range([0, width]);

	const yScale = d3.scaleLinear()
		.domain([0, d3.max(trips.map(t => t.avspeed))]).nice()
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

	// x axis label
	svg.append('text')
		.attr('class', 'label')
		.attr('x', (width + margin.left + margin.right) / 2)
		.attr('y', height + margin.bottom)
		.attr('font-size', 14)
		.attr('font-style', 'italic')
		.style('text-anchor', 'end')
		.text('Duration (min)');

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
	let tooltip = d3.select('body')
		.append('g')
		.append('div')
		.attr('class', 'tooltip')
		.style('opacity', 1.0);

	// Tooltip mouseover handler
	let tipMouseover = t => {
		let html = 'Duration: ' + (t.duration / 60)
					+ "<br/>"
					+ 'Avg Speed: ' + t.avspeed.toFixed(2);

		tooltip.html(html)
			.style('left', (d3.event.pageX + 15) + 'px')
			.style('top', (d3.event.pageY - 28) + 'px')
			.transition()
			.duration(200)
			.style('opacity', 0.9)
	};

	let tipMouseout = () => {
		tooltip.transition()
			.duration(300)
			.style('opacity', 0)
	};

	svg.selectAll('.dot')
		.data(trips)
		.enter().append('circle')
		.attr('class', 'dot')
		.attr('cx', t => xScale(t.duration / 60))
		.attr('cy', t => yScale(t.avspeed))
		.attr('r', 4)
		.on('mouseover', tipMouseover)
		.on('mouseout', tipMouseout);
}

function ScatterDistanceDuration(trips) {
	// Initialize svg for plot
	var margin = {left: 40, top: 50, right: 20, bottom: 30},
		width = $("#plot2").width() - margin.left - margin.right,
		height = $('#plot2').height() - margin.bottom - margin.top;

	var svg = d3.select("#plot2")
		.append('svg')
		.attr("width", (width + margin.left + margin.right))
		.attr("height", (height + margin.top + margin.bottom))
		.append('g')
		.attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

	// Generate x and y axis scales
	const xScale = d3.scaleLinear()
		.domain([0, d3.max(trips.map(t => t.duration / 60)) + 4])
		.range([0, width]);

	const yScale = d3.scaleLinear()
		.domain([0, d3.max(trips.map(t => t.distance / 1000))]).nice()
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

	// x axis label
	svg.append('text')
		.attr('class', 'label')
		.attr('x', (width + margin.left + margin.right) / 2)
		.attr('y', height + margin.bottom)
		.attr('font-size', 14)
		.attr('font-style', 'italic')
		.style('text-anchor', 'end')
		.text('Duration (min)');

	// y axis label
	svg.append('text')
		.attr('class', 'label')
		.attr('transform', 'rotate(-90)')
		.attr('x', -(height / 2.5))
		.attr('y', -(margin.left / 1.5))
		.attr('font-size', 14)
		.attr('font-style', 'italic')
		.style('text-anchor', 'end')
		.text('Distance');

	// Main title
	svg.append('text')
		.attr('x', width / 2)
		.attr('y', -margin.top / 2)
		.attr('dy', '.35em')
		.attr('font-size', 18)
		.attr('font-weight', 'bold')
		.attr('fill', 'black')
		.style('text-anchor', 'middle')
		.text('Distance vs. Duration');

	// Tooltip div
	let tooltip = d3.select('body')
		.append('g')
		.append('div')
		.attr('class', 'tooltip')
		.style('opacity', 1.0);

	// Tooltip mouseover handler
	let tipMouseover = t => {
		let html = 'Duration: ' + (t.duration / 60)
			+ "<br/>"
			+ 'Distance: ' + (t.distance / 1000).toFixed(2);

		tooltip.html(html)
			.style('left', (d3.event.pageX) + 'px')
			.style('top', (d3.event.pageY) + 'px')
			.transition()
			.duration(200)
			.style('opacity', 0.9)
	};

	let tipMouseout = () => {
		tooltip.transition()
			.duration(300)
			.style('opacity', 0)
	};

	svg.selectAll('.dot')
		.data(trips)
		.enter().append('circle')
		.attr('class', 'dot')
		.attr('cx', t => xScale(t.duration / 60))
		.attr('cy', t => yScale(t.distance / 1000))
		.attr('r', 4)
		.on('mouseover', tipMouseover)
		.on('mouseout', tipMouseout);
}

function ScatterSpeedDistance(trips) {
	// Initialize svg for plot
	var margin = {left: 40, top: 50, right: 20, bottom: 30},
		width = $("#plot3").width() - margin.left - margin.right,
		height = $('#plot3').height() - margin.bottom - margin.top;

	var svg = d3.select("#plot3")
		.append('svg')
		.attr("width", (width + margin.left + margin.right))
		.attr("height", (height + margin.top + margin.bottom))
		.append('g')
		.attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

	// Generate x and y axis scales
	const xScale = d3.scaleLinear()
		.domain([0, d3.max(trips.map(t => t.distance / 1000)) + 4])
		.range([0, width]);

	const yScale = d3.scaleLinear()
		.domain([0, d3.max(trips.map(t => t.avspeed))]).nice()
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

	// x axis label
	svg.append('text')
		.attr('class', 'label')
		.attr('x', (width + margin.left + margin.right) / 2)
		.attr('y', height + margin.bottom)
		.attr('font-size', 14)
		.attr('font-style', 'italic')
		.style('text-anchor', 'end')
		.text('Distance');

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
		.text('Avg Speed vs. Distance');

	// Tooltip div
	let tooltip = d3.select('body')
		.append('g')
		.append('div')
		.attr('class', 'tooltip')
		.style('opacity', 1.0);

	// Tooltip mouseover handler
	let tipMouseover = t => {
		let html = 'Distance: ' + (t.distance / 1000).toFixed(2)
			+ "<br/>"
			+ 'Avg Speed: ' + t.avspeed.toFixed(2);

		tooltip.html(html)
			.style('left', (d3.event.pageX) + 'px')
			.style('top', (d3.event.pageY) + 'px')
			.transition()
			.duration(200)
			.style('opacity', 0.9)
	};

	let tipMouseout = () => {
		tooltip.transition()
			.duration(300)
			.style('opacity', 0)
	};

	svg.selectAll('.dot')
		.data(trips)
		.enter().append('circle')
		.attr('class', 'dot')
		.attr('cx', t => xScale(t.distance / 1000))
		.attr('cy', t => yScale(t.avspeed))
		.attr('r', 4)
		.on('mouseover', tipMouseover)
		.on('mouseout', tipMouseout);
}

function DrawWordcloud(trips) {

	// Create array containing all street names
	let streets = [];
	trips.map(t => {
		t.streetnames.forEach(st => {
			streets.push(st);
		})
	});

	// Create dictionary containing street counts
	let streetCount = Object.create(null);
	for(let i = 0; i < streets.length; i++) {
		let word = streets[i];
		if (!streetCount[word]) {
			streetCount[word] = 1;
		} else {
			streetCount[word]++;
		}
	}

	let margin = {top: 70, right: 100, bottom: 0, left:100},
		width = $('#word-cloud').width() - margin.left - margin.right,
		height = $('#word-cloud').height() - margin.top - margin.bottom;

	//
	let svg = d3.select('#word-cloud')
		.append('svg')
		.attr('width', width + margin.left + margin.right)
		.attr('height', height + margin.top + margin.bottom);

	let xScale = d3.scaleLinear()
		.range([10, 100]);

	let focus = svg.append('g')
		.attr('transform', 'translate(' + [width/2, height/2 + margin.top] + ')');

	let colorMap = ['red', '#a38b07'];

	let rng = new alea('hello.');

	xScale.domain(d3.extent(streetCount, d => d.value));

	// makeCloud is failing
	makeCloud();

	function makeCloud() {
		d3.layout.cloud().size([width, height])
			.timeInterval(20)
			.words(streetCount)
			.fontSize(d => xScale(+d.value))
			.text(d => d.key)
			.font('Impact')
			.random(rng)
			.on('end', output => draw(output))
			.start();
	}

	d3.layout.cloud().stop();

	function draw(words) {
		focus.selectAll('text')
			.data(words)
			.enter()
			.append('text')
			.style('font-size', d => xScale(d.value) + 'px')
			.style('font-family', 'Impact')
			.style('fill', (d, i) => colorMap[~~(rng() *2)])
			.attr('text-anchor', 'middle')
			.attr('transform', d => 'translate(' + [d.x, d.y] + ')rotate(' + d.rotate + ')')
			.text(d => d.key);
	}
}

function DrawBarChart(trips) {
	console.log('here');

	// Initialize svg for plot
	var margin = {left: 40, top: 50, right: 20, bottom: 30},
		width = $("#bar-chart").width(),
		height = $('#bar-chart').height();

	console.log($('#bar-chart').width(), $('#bar-chart').height());

	var svg = d3.select("#bar-chart")
		.append('svg')
		.attr("width", (width + margin.left + margin.right))
		.attr("height", (height + margin.top + margin.bottom))
		.append('g')
		.attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

}

function DrawChordPlot(trips) {

}
