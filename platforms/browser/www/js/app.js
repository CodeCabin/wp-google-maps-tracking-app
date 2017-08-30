(function($) {
	
	function App()
	{
		var self = this;
		
		this.lastBroadcastTime = new Date().getTime();
		this.lastBroadcastFailed = false;
		this.lastBroadcastResponsePending = false;
		this.trackingEnabled = false;
		
		// Settings button and first run
		//if(!localStorage.doneFirstRun)
			$("#settings").removeClass("closed");
		//localStorage.doneFirstRun = true;
		
		$("#settings .close").on("click", function(event) {
			$("#settings").toggleClass("closed");
		});
		
		// Record button
		$("#record").on("click", function(event) {
			var button = $(event.target);
			
			if(!self.trackingEnabled)
			{
				button.removeClass("fa-circle");
				button.addClass("fa-stop-circle");
				
				self.status("geolocation", "Pending");
				self.status("broadcast", "Pending");
				
				$("input[name='route-polyline-id']").val("-1");
				self.trackingEnabled = true;
			}
			else
			{
				button.removeClass("fa-stop-circle");
				button.addClass("fa-circle");
				
				self.trackingEnabled = false;
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
			zoom: 18
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
		
		setInterval(function() {
			self.onTimer();
		}, 1000);
		
		this.status("broadcast", "Pending");
		
		// Debug
		$("#record").click();
		
		// Geolocation
		this.positionBuffer = [];
		
		window.navigator.geolocation.watchPosition(
			function(position) {
				self.onPositionChanged(position);
			},
			function(error) {
				self.status("geolocation", JSON.stringify(error));
			},
			{
				enableHighAccuracy: true
			}
		);
	}
	
	App.prototype.status = function(where, str)
	{	
		var now = new Date().getTime();
	
		$("." + where + "-status").find(".message").html(str);
		$("." + where + "-status").find(".time").attr("data-timestamp", now);
	}
	
	App.prototype.broadcast = function()
	{
		var self = this;
		var url = $("input[name='post-url']").val();
		
		if(!url.length)
		{
			this.status("broadcast", "No site URL entered");
			return;
		}
		
		if(!url.match(/^http(s)?:\/\//))
			url = "http://" + url;
		
		var broadcastLength = this.positionBuffer.length;
		this.lastBroadcastTime = new Date().getTime();
		this.waitingForResponse = true;
		
		var data = {
			action: "wpgmza_record_live_tracking"
		};
		
		$("input, select").each(function(index, el) {
			var name = $(el).attr("name");
			
			if(!name)
				return;
			
			data[name] = $(el).val();
		});
		
		data.payload = this.positionBuffer;
		
		this.status("broadcast", "Broadcasting data");
		this.lastBroadcastResponsePending = true;
		
		$.ajax({
			type: "POST",
			url: url + "?cachebuster=" + (new Date().getTime()),
			data: data,
			complete: function()
			{
				self.lastBroadcastResponsePending = false;
			},
			success: function(response)
			{
				var json;
				
				$("#debug").html(response);
				
				try{
					json = JSON.parse(response);
				}catch(e) {
					self.status("broadcast", "Failed (Unexpected response)");
					self.lastBroadcastFailed = true;
					return;
				}
				
				if(!json.success)
				{
					self.status("broadcast", json.message);
					self.lastBroadcastFailed = true;
					return;
				}
				
				self.lastBroadcastFailed = false;
				self.status("broadcast", "Successful");
				
				if(json["route-polyline-id"])
					$("input[name='route-polyline-id']").val(json["route-polyline-id"]);
				
				self.positionBuffer.splice(0, broadcastLength);
			},
			error: function(xhr, textStatus)
			{
				self.status("broadcast", "Failed (" + textStatus + ")");
				self.lastBroadcastFailed = true;
			}
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
		
		this.status("geolocation", position.coords.latitude + ", " + position.coords.longitude);
		
		if(!this.trackingEnabled)
			return;
		
		this.positionBuffer.push(position);
	}
	
	App.prototype.onTimer = function()
	{
		// Status time update
		$("fieldset .time[data-timestamp]").each(function(index, el) {
			var timestamp = $(el).attr("data-timestamp");
			var date = new Date(parseFloat(timestamp));
			
			$(el).html(moment(date).fromNow());
		});
		
		if(!this.trackingEnabled)
		{
			this.status("broadcast", "Not recording");
			return;
		}
		
		if(!this.positionBuffer.length || ($("input[name='route-polyline-id']").val() == -1 && this.positionBuffer.length < 2))
		{
			this.status("broadcast", "No data to broadcast");
			return;
		}
		
		// Broadcast
		var now = new Date().getTime();
		var delta = now - this.lastBroadcastTime;
		var max = parseInt($("select[name='frequency']").val()) * 1000;
		
		var due = new Date(this.lastBroadcastTime + max);
		
		if(!this.lastBroadcastFailed && !this.lastBroadcastResponsePending)
			this.status("broadcast", "Due " + moment(due).fromNow());
		
		if(delta > max)
			this.broadcast();
	}
	
	$(document).ready(function() {
		
		// TODO: Disable
		window.wpgmzaApp = new App();
		
	});
	
})(jQuery);