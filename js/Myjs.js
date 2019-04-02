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

				// Page 1
				ScatterSpeedDuration(result);
				ScatterDistanceDuration(result);
				ScatterSpeedDistance(result);
				// Page 2
				DrawWordcloud(result);
				DrawBarChart(result);
				// Page 3
				DrawChordPlot(result);
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
	const margin = {left: 40, top: 50, right: 20, bottom: 30},
		width = $("#plot1").width() - margin.left - margin.right,
		height = $('#plot1').height() - margin.bottom - margin.top;

	let svg = d3.select("#plot1")
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

	// Tooltip mouseover handlers
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

	// Add points to scatterplot
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
	const margin = {left: 40, top: 50, right: 20, bottom: 30},
		width = $("#plot2").width() - margin.left - margin.right,
		height = $('#plot2').height() - margin.bottom - margin.top;

	let svg = d3.select("#plot2")
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

	// Tooltip mouseover handlers
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

	// Add points to scatterplot
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
	const margin = {left: 40, top: 50, right: 20, bottom: 30},
		width = $("#plot3").width() - margin.left - margin.right,
		height = $('#plot3').height() - margin.bottom - margin.top;

	let svg = d3.select("#plot3")
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
		.text('Average Speed vs. Distance');

	// Tooltip div
	let tooltip = d3.select('body')
		.append('g')
		.append('div')
		.attr('class', 'tooltip')
		.style('opacity', 1.0);

	// Tooltip mouseover handlers
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

	// Add points to scatterplot
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

	// Initialize svg for word cloud
	let margin = {top: 10, right: 10, bottom: 10, left:10},
		width = $('.half-page').width() * 4 + 65,
		height = $('.half-page').height() * 7 + 40;

	let svg = d3.select('#word-cloud')
		.append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
		.attr('transform', 'translate(' + [width/2, height/2] + ')');

	// Create d3 data array from street count dict
    let word_entries = d3.entries(streetCount);

    // Set the range for font size scale
    let xScale = d3.scaleLinear()
        .domain(d3.extent(word_entries, d => d.value))
        .range([6, 28]);

    let colorMap = ["#8b0707", "#dc3912", "#ff9900", "#109618",
					"#0099c6", "#990099"];

    // Seeded random number generator
    let arng = new alea('hello.');

    makeCloud();

    // Layout the wordcloud
    function makeCloud() {
        d3.layout.cloud().size([width, height])
            .timeInterval(20)
            .words(word_entries)
            .fontSize(d => xScale(+d.value))
            .text(d => d.key)
            .font('Impact')
            .random(arng)
            .on('end', output => draw(output))
            .start()
    }

    d3.layout.cloud().stop();

    // Draw words on wordcloud
    function draw(words) {
        svg.selectAll('text')
            .data(words)
            .enter()
            .append('text')
            .style('font-size', d => xScale(d.value) + 'px')
            .style('font-family', 'Impact')
            .style('fill', (d, i) => colorMap[i % colorMap.length])
            .attr('text-anchor', 'middle')
            .attr('transform', d => {
                return 'translate(' + [d.x, d.y] + ')rotate(' + d.rotate + ')';
            })
            .text(d => d.key);
    }
}

function DrawBarChart(trips) {
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

	// Initialize svg for plot
	let margin = {left: 30, top: 10, right: 10, bottom: 10},
		width = $(".half-page").width() * 4.5 - 20,
		height = $('.half-page').height() * 8 - 30;

	let svg = d3.select("#bar-chart")
		.append('svg')
		.attr("width", width)
		.attr("height", height)
		.append('g')
		.attr('transform', 'translate(' + (margin.left + 10) + ',' + (margin.top + 10) + ')');

	// Sort data by number of times a street occurs
	function compare(a, b) {
		let countA = a.value,
			countB = b.value;

		if(countA > countB) {
			return -1;
		} else if (countA < countB) {
			return 1;
		} else {
			return 0;
		}
	}

	let data = d3.entries(streetCount);
	data.sort(compare);

	// Slice top 15 streets to graph in barchart
	data = data.slice(0, 15);

	// Generate x and y axis scales
	let xScale = d3.scaleBand()
		.domain(data.map(d => d.key))
		.rangeRound([0, width - margin.left])
		.padding(0.1);

	let yScale = d3.scaleLinear()
		.domain([0, d3.max(data.map(d => d.value))]).nice()
		.rangeRound([height-30, 0]);

	const xAxis = d3.axisBottom(xScale);
	const yAxis = d3.axisLeft(yScale);

	// x axis path and ticks
	svg.append('g')
		.attr('class', 'axis')
		.attr('class', 'bar-axis')
		.attr('transform', 'translate(0, ' + (height-30) + ')')
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
        .attr('y', -(margin.left))
        .attr('font-size', 14)
        .attr('font-style', 'italic')
        .style('text-anchor', 'end')
        .text('# Occurrences');

    // Main title
    svg.append('text')
        .attr('x', width / 2)
        .attr('y', -margin.top / 2)
        .attr('dy', '.35em')
        .attr('font-size', 18)
        .attr('font-weight', 'bold')
        .attr('fill', 'black')
        .style('text-anchor', 'middle')
        .text('Top 15 Most Frequent Streets');

	// Tooltip div
	let tooltip = d3.select('body')
		.append('g')
		.append('div')
		.attr('class', 'tooltip')
		.style('opacity', 1.0);

	// Tooltip mouseover handlers
	let tipMouseover = d => {
		let html = 'Street: <strong>' + d.key + '</strong>'
			+ '<br/>'
			+ 'Occurrences: ' + d.value;

		tooltip.html(html)
			.style('left', (d3.event.pageX) + 'px')
			.style('top', (d3.event.pageY) + 'px')
			.transition()
			.duration(200)
			.style('opacity', 0.95)
	};

	let tipMouseout = () => {
		tooltip.transition()
			.duration(300)
			.style('opacity', 0)
	};

	let colorMap = ["#8b0707", "#dc3912", "#ff9900", "#109618",
		"#0099c6", "#990099"];

	// Add bars to plot
	svg.selectAll('.bar')
		.data(data)
		.enter()
		.append('rect')
		.attr('class', 'bar')
		.attr('x', d => xScale(d.key))
		.attr('y', d => (yScale(d.value) - margin.left + 30))
		.attr('width', xScale.bandwidth())
		.attr('height', d => (height - 30 - yScale(d.value)))
		.attr('fill', (d, i) => colorMap[i % colorMap.length])
		.on('mouseover', tipMouseover)
		.on('mouseout', tipMouseout);
}

function DrawChordPlot(trips) {
	// Extract start and end street names for each trip
	let streets = trips.map(t => {
		if (t.streetnames.length >= 2) {
			return {
				start: t.streetnames[0],
				end: t.streetnames[t.streetnames.length - 1]
			};
		}
	});

	const indexByName = new Map;
	const nameByIndex = new Map;
	let matrix = [];
	let n = 0;

	// Identify unique streets to create groups
	let uniqueStreets = [];
	streets.map(s => {
		uniqueStreets.push(s.start);
		uniqueStreets.push(s.end);
	});
	uniqueStreets = [...new Set(uniqueStreets)];

	// Assign an index for each unique street
	uniqueStreets.forEach(d => {
		if (!indexByName[d]) {
			nameByIndex.set(n, d);
			indexByName.set(d, n++);
		}
	});

	// Create flow matrix between start and end streets using assigned indices
	streets.forEach(d => {
		const source = indexByName.get(d.start);
		let row = matrix[source];

		if (!row) {
			row = matrix[source] = Array.from({length: n}).fill(0);
		}
		row[indexByName.get(d.end)]++
	});

	// Initialize svg for plot
	let margin = {left: 30, top: 30, right: 30, bottom: 30},
		width = $("#chord-plot").width()*5 - margin.left - margin.right,
		height = $('#chord-plot').height()*7 - margin.bottom;

	let svg = d3.select("#chord-plot")
		.append('svg')
		.attr("width", (width + margin.left + margin.right))
		.attr("height", (height + margin.top + margin.bottom))
		.append('g')
		.attr('transform', 'translate(' + ((width + 15)/2) + ',' + (height/2) + ')');

	// Main title
	svg.append('text')
		.attr('x', 0)
		.attr('y', -margin.top - height/3 - 50)
		.attr('dy', '0.35em')
		.attr('font-size', 18)
		.attr('font-weight', 'bold')
		.attr('fill', 'black')
		.style('text-anchor', 'middle')
		.text('Chord Plot of Taxi Trips');

	svg.append('text')
		.attr('x', 0)
		.attr('y', -margin.top - height/3 - 50)
		.attr('dy', '1.5em')
		.attr('font-size', 18)
		.attr('font-weight', 'bold')
		.attr('fill', 'black')
		.style('text-anchor', 'middle')
		.text('(Hover for trip details)');

	// Create chords from flow matrix
	let chord = d3.chord()
		.padAngle(.04)
		.sortSubgroups(d3.descending)
		.sortChords(d3.descending);

	let chords = chord(Object.values(matrix));

	let color = d3.scaleOrdinal(d3.schemeCategory10);

	// Tooltip div for arc segments
	let arcTooltip = d3.select('body')
		.append('g')
		.append('div')
		.attr('class', 'tooltip')
		.style('opacity', 1.0);

	// Tooltip mouseover handlers
	let arcTipMouseover = d => {
		let html = 'Street: ' + nameByIndex.get(d.index)
			+ '<br/>'
			+ 'Number of Trips: ' + d.value;

		arcTooltip.html(html)
			.style('left', (d3.event.pageX) + 'px')
			.style('top', (d3.event.pageY) + 'px')
			.transition()
			.duration(200)
			.style('opacity', 0.95)
	};

	let arcTipMouseout = () => {
		arcTooltip.transition()
			.duration(300)
			.style('opacity', 0)
	};

	const innerRadius = 200,
		outerRadius = 215;

	// Draw outer arc segments for each street (group)
	svg.datum(chords)
        .append('g')
        .selectAll('g')
        .data(d => d.groups)
        .enter()
        .append('g')
        .append('path')
        .style('fill', d => color(d.index))
        .style('stroke', 'black')
        .attr('d', d3.arc()
            .innerRadius(innerRadius)
            .outerRadius(outerRadius)
        )
		.on('mouseover', arcTipMouseover)
		.on('mouseout', arcTipMouseout);

	// Tooltip div for ribbon segments
	let ribbonTooltip = d3.select('body')
		.append('g')
		.append('div')
		.attr('class', 'tooltip')
		.style('opacity', 1.0);

	// Tooltip mouseover handlers
	let ribbonTipMouseover = d => {
		let html = nameByIndex.get(d.source.index)
			+ ' &#8594 '
			+ nameByIndex.get(d.target.index);

		ribbonTooltip.html(html)
			.style('left', (d3.event.pageX) + 'px')
			.style('top', (d3.event.pageY) + 'px')
			.transition()
			.duration(200)
			.style('opacity', 0.95)
	};

	let ribbonTipMouseout = () => {
		ribbonTooltip.transition()
			.duration(300)
			.style('opacity', 0)
	};

	// Draw ribbons between streets (groups)
	svg.datum(chords)
		.append('g')
		.selectAll('path')
		.data(d => d)
		.enter()
		.append('path')
        .attr('class', 'chord')
		.attr('d', d3.ribbon()
			.radius(innerRadius)
		)
		.style('fill', d => color(d.source.index))
		.style('stroke', 'black')
		.on('mouseover', ribbonTipMouseover)
		.on('mouseout', ribbonTipMouseout);
}