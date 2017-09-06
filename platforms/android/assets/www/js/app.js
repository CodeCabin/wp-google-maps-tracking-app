(function($) {
	
	function App()
	{
		var self = this;
		
		this.routePolylineID = -1;
		this.tracking = false;
		
		// Settings button and first run
		if(!localStorage.doneFirstRun)
			$("#settings").removeClass("closed");
		localStorage.doneFirstRun = true;
		
		$("#settings .close").on("click", function(event) {
			$("#settings").toggleClass("closed");
		});
		
		// Record button
		$("#record").on("click", function(event) {
			var button = $(event.target);
			
			if(!this.tracking)
			{
				if($("input[name='post-url']").val().length == 0)
				{
					self.showWarning("You must enter a URL in the settings panel");
					return;
				}
				
				self.showWarning("No data has been recorded yet");
				
				BackgroundGeolocation.setConfig({
					url: self.getURL(),
					params: self.getBackgroundGeolocationPOSTParams()
				});
				
				// Start tracking in background
				BackgroundGeolocation.start();
				
				button.addClass("fa-stop-circle");
				
				this.tracking = true;
			}
			else
			{
				self.showWarning("Tracking manually stopped");
				
				BackgroundGeolocation.stop();
				
				this.routePolylineID = -1;
				this.tracking = false;
				
				button.removeClass("fa-stop-circle");
			}
		});
		
		// Remember settings
		$("input, select").each(function(index, el) {
			var name = $(el).attr("name");
			
			if(!name)
				return;
			
			if(localStorage[name])
				$(el).val(localStorage[name]);
		});
		
		$("form").on("change input", function(event) {
			var name = $(event.target).attr("name");
			
			if(name)
				localStorage[name] = $(event.target).val();
		});
		
		// Device ID
		this.deviceID = this.getDeviceID();
		$("input[name='device-id']").val(this.deviceID);
		
		// Map preview
		var baseLayer = new ol.layer.Tile({
			source: new ol.source.OSM()
		});
		
		this.view = new ol.View({
			center: ol.proj.fromLonLat([0,0]),
			zoom: 12
		});
		
		this.map = new ol.Map({
			target: 'map',
			layers: [baseLayer],
			view: this.view
		});
		
		this.marker = new ol.Overlay({
			element: $("img.marker")[0],
			positioning: 'bottom-center'
		});
		
		this.map.addOverlay(this.marker);
		
		// Background geolocation
		var options = {
			url: this.getURL(),
			method: "POST",
			params: this.getBackgroundGeolocationPOSTParams(),
			distanceFilter: 1,
			foregroundService: true,
			// debug: true,
			notificationTitle: "WP Google Maps Live Tracking App",
			stopOnTerminate: false,
			fastestLocationUpdateInterval: 1000
		};
		
		document.addEventListener("deviceready", function() {
			BackgroundGeolocation.configure(options, function(state) {
				self.onGeolocationConfigured(state);
			});
		});
	}
	
	App.VERSION = "1.0.0";
	
	App.prototype.getURL = function()
	{
		return $("input[name='post-url']").val().replace(/\/$/, "") + "/wp-admin/admin-ajax.php?action=wpgmza_record_live_tracking";
	}
	
	App.prototype.getBackgroundGeolocationPOSTParams = function()
	{
		var params = {
			"map_id": 				$("input[name='map_id']").val(),
			"device-id":			this.deviceID,
			"route-polyline-id":	this.routePolylineID
		};
		
		return params;
	}
	
	App.prototype.showWarning = function(text)
	{
		if(!text)
			$("#response-warning").hide();
		else
			$("#response-warning").html(text).show();
	}
	
	App.prototype.onGeolocationConfigured = function(state)
	{
		var self = this;
		
		BackgroundGeolocation.on("location", function(location) {
			self.onPositionChanged(location);
		}, function(error) {
			
		});
		
		BackgroundGeolocation.on("http", function(response) {
			
			var status = response.status;
			
			console.log(response);
			
			if(response.status != 200)
			{
				self.showWarning("Unexpected response from server (" + response.status + ")");
				
				console.log(response);
				
				return;
			}
			
			try{
				var json = JSON.parse(response.responseText);
			}catch(e) {
				self.showWarning("Failed to parse response from server");
				
				console.log(response);
				
				return;
			}
			
			if(json["route-polyline-id"])
			{
				self.routePolylineID = json["route-polyline-id"];
				BackgroundGeolocation.setConfig({
					params: self.getBackgroundGeolocationPOSTParams()
				});
			}
			
			if(json.success == false)
			{
				self.showWarning(json.message);
				return;
			}
			
			self.showWarning(false);
		});
	}
	
	App.prototype.getDeviceID = function()
	{
		if(window.localStorage && localStorage.deviceID)
			return localStorage.deviceID;
		
		var arr = new Uint8Array(64 / 8);
		var str = "";
		
		window.crypto.getRandomValues(arr);
		
		for(var i = 0; i < arr.length; i++)
			str += arr[i].toString(16);
		
		if(window.localStorage)
			localStorage.deviceID = str;
		
		return str;
	}
	
	App.prototype.onPositionChanged = function(position)
	{
		var projected = ol.proj.fromLonLat([
			position.coords.longitude,
			position.coords.latitude
		]);
		
		this.view.setCenter(projected);
		this.marker.setPosition(projected);
	}
	
	$(document).ready(function() {
		
		// TODO: Disable
		window.wpgmzaApp = new App();
		
	});
	
})(jQuery);